import Client from "../src/Main";
import config from "./config"
const db = new Client(config, "test")
db.connect().then(async () => {
    const myCollection = db.collection("test")
    console.log(await myCollection.set("test.test", {}))
})