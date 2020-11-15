import mongo from "mongodb";
import Collection from "./Collection"
import { EventEmitter } from "events";
/** 
 * The class to connect to and use mongo 
 */
class Main {
  private uri: string
  private options: object;
  private mongo: mongo.MongoClient;
  public db: any;
  public db_name: string
  /**
   *
   * @param uri The connection string to connect to mongo db with
   * @param db The database which to use
   */
  constructor(uri: string, db?: string) {
    if (!db) db = "test"
    if (!uri) throw new TypeError("Please provide a MongoDB connection uri!");
    this.uri = uri;
    this.db_name = db;
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      keepAlive: true
    };
    this.mongo = new mongo.MongoClient(this.uri, this.options)
  };
  public async connect() {
    if (this.mongo.isConnected()) return;
    await this.mongo.connect();
    this.db = this.mongo.db(this.db_name);

  }
  /**
   * Closes and reopens the connection
   */
  public async reconnect(): Promise<void> {
    await this.mongo.close()
    await this.mongo.connect();
    return;
  };
  public collection(name: string) {
    return new Collection(this, name)
  }
};
export default Main;
