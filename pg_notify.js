import createSubscriber from "pg-listen"
import pool from "./pool.js";
import { pushOrder } from "./index.js";
import { pushReflex } from "./reflex.js";
import { pushResults } from "./resulting.js";
import 'dotenv/config';

// Accepts the same connection config object that the "pg" package would take
const subscriber = createSubscriber({ connectionString: `postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}` })

subscriber.notifications.on("new_order",async (payload) => {
  // Payload as passed to subscriber.notify() (see below)
  // console.log( payload.id)
  pushOrder(payload.id)
  // await pool.query(`insert into registry.oe_import (order_id)values (${payload.id})`)
})


subscriber.notifications.on("new_reflex",async (payload) => {
  // Payload as passed to subscriber.notify() (see below)
 //  console.log( payload)

   setTimeout(()=>{

	  pushReflex(payload.order_id,payload.sample_id)

	},5000)


  // await pool.query(`insert into registry.oe_import (order_id)values (${payload.id})`)
})


subscriber.notifications.on("new_result",async (payload) => {
  // Payload as passed to subscriber.notify() (see below)
  // console.log( payload.id)
  pushResults(payload.barcode,payload.result,payload.test_id,payload.sample_id)
  // await pool.query(`insert into registry.oe_import (order_id)values (${payload.id})`)
})

subscriber.events.on("error", (error) => {
  console.error("Fatal database connection error:", error)
  process.exit(1)
})

process.on("exit", () => {
  subscriber.close()
})

export async function connect () {
  await subscriber.connect()
  await subscriber.listenTo("new_order")
  await subscriber.listenTo("new_result")
  await subscriber.listenTo("new_reflex")

  console.log(subscriber.getSubscribedChannels().length>0 ? 'listening' : 'no channels found')
}


connect()


