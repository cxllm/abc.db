import mongo from "mongodb";
import Main from "./Main"
import set from "lodash/set"
import get from "lodash/get"
/**
 * The collection class for a new collection inside the mongo db
 * This class follows a keyv structure
 */
class Collection {
    /**
     * A simple mongo collection class so you can easily create, find and delete data.
     * @param name The name of your Collection.
     */
    private collection: mongo.Collection;
    private client: Main;
    constructor(main: Main, name: string) {
        if (!name) throw new TypeError("Please provide a collection name!")
        this.client = main;
        this.collection = this.client.db.collection(name);
    };

    /**
     * Set a value to a key inside your collection
     * @param key The key to set the value to
     * @param value The value to set the key to
     */
    async set(key: string, value: any): Promise<any> {
        if (!key) throw new TypeError("Please provide a key to set to!")
        if (!value) throw new TypeError("Please provide a value to set the key to!")
        let keyarr: string[] = key.split(".");
        key = keyarr.shift() || key;
        let data = await this.__rawData(key);
        value = keyarr[0] ? set({ value: data.value ?? value }, `value.${keyarr.join(".")}`, value).value : value //parse dot notation 
        if (!data) {
            await this.collection.insertOne({
                key: key,
                value: value
            }); //insert the data if it does not exist
        } else {
            this.collection.replaceOne({ key }, { key, value }) //replace it if it does exist
        }
        return value
    }
    /**
     * Add a number to something in the database (will add to 0 if not a number)
     * @param key The key to add to
     * @param number The number to add
     */
    async add(key: string, number: number): Promise<number> {
        if (!key) throw new TypeError("Please provide a key to set to!")
        if (!number || typeof number !== "number") throw new TypeError("Please provide a valid number to add!")
        let data = await this.__rawData(key);
        if (!data) data = await this.set(key, number)
        else {
            if (typeof data.value !== "number") data.value = number;  //replace the current value with the number requested if not a number
            else data.value += number; //add the number to the value otherwise
            data = await this.set(key, data.value)
        }
        return data;
    }
    /**
     * Subtract a number from something in the database (will subtract from 0 if not a number)
     * @param key The key to subtract from
     * @param number The number to subtract
     */
    async subtract(key: string, number: number): Promise<number> {
        if (!key) throw new TypeError("Please provide a key to set to!")
        if (!number || typeof number !== "number") throw new TypeError("Please provide a number to subtract!")
        let data = await this.__rawData(key);
        if (!data) data = await this.set(key, number)
        else {
            if (typeof data.value !== "number") data.value = 0 - number; //replace the current value with the number requested if not a number
            else data.value -= number; //take away the number from the valye otherwise
            data = await this.set(key, data.value)
        }

        return data;
    }
    /**
     * Check if the database has a value for a key
     * @param key The key to find
     */
    async has(key: string): Promise<boolean> {
        return this.__rawData(key) ? true : false;
    }
    /**
     * Push something inside an array
     * @param key The key of the array to push
     * @param value The value to push
     */
    async push(key: string, value: any): Promise<Array<any>> {
        if (!key) throw new TypeError("Please provide a key to push to!")
        if (!value) throw new TypeError("Please provide a value to push!")
        let data = await this.__rawData(key);
        if (!data) data = await this.set(key, [value])
        else if (typeof data.value !== "object") {
            data.value = [data.value, value]; //add the value to an array alongside the current value if it is not an array
        } else {
            try {
                data.value.push(value); //push to the array
            } catch {
                data.value = [data.value, value]; //add the value to an array alongside the current value if it is not an array
            }
            data = await this.set(key, data.value)
        }

        return data;
    }
    /**
     * Gets a key inside the database
     * @param key The key to find
     * @returns The thing found, or false
     */
    async get(key: string): Promise<any> {
        if (!key) throw new TypeError("Please provide a key to find!")
        return (await this.__rawData(key))?.value
    }
    /**
     * Removes something from the database
     * @param key The key to delete
     * @returns {Boolean} If the key was deleted or not
     */
    async delete(key: string): Promise<boolean> {
        if (!key) throw new TypeError("Please provide a key to delete!")
        let data = await this.collection.findOneAndDelete({ key }); // delete the key
        if (!data) return false;
        return true;
    }
    /**
     * Gets all entries in the database
     * @returns  An array of all data
     */
    async getAll(): Promise<Array<{ key: string, value: any }>> {
        return new Promise(async (resolve) => {
            let data = await this.collection.find(); // request all documents
            let arr: Array<{ key: string, value: any }> = [];
            data.on("data", async (doc: any) => { // for every document do something
                arr.push({
                    key: doc.key,
                    value: doc.value
                })
            })
            data.on("close", () => {
                resolve(arr) //resolve the finished data once done
            })
        })
    }

    /**
    * Gets an entry in the database
    * @param key The key to find
    * @returns {(Object|Boolean)} The thing found, or false
    */
    async find(key: string): Promise<any> {
        return await this.get(key);
    }
    /**
     * Migrates data from the quick.db module to mongo
     * @param data The data from your quick.db database
     */
    async migrateFromQuickDB(data: Array<{ ID: string, data: any }>): Promise<void> {
        for (const item of data) {
            if (!item.ID || !item.data) throw new TypeError("This is not valid quick.db data!")
            await this.set(item.ID, item.data);
        }
    }
    /**
     * Make something execute for every entry in the database
     * @param cb The function to execute
     */
    async forEach(cb: (param: { key: string, value: any }) => void): Promise<void> {
        (await this.getAll()).forEach(cb);
    }
    /**
     * Delete all the items inside the database
     */
    async deleteAll(): Promise<void> {
        const data = await this.collection.find();
        data.on("data", async (doc: any) => {
            await this.delete(doc.key)
        })
        return;
    }
    /**
     * Get the raw mongoose data of any key
     * @param key The key to get the raw data of inside the database.
     */
    private async __rawData(key: string) {
        let keyarr: string[] = key.split("."); //dot notation handling
        key = keyarr.shift() || key;
        let data = await this.collection.findOne({ key }); //fetch the data from the database
        data = get(data, `value.${keyarr.join(".")}`) || data || false; //dot notation handling
        return data;
    }
}
export default Collection