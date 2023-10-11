import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

import pool from './pool.js';

let OE_HOST = process.env.OE_HOST
import 'dotenv/config';
import fetch from 'node-fetch';
export async function pushOrder(order){
    const getOrder = await pool.query(`select patient,ward ,labno,to_char(request_time,'HH24:mi') rtime, to_char(request_time,'dd/mm/yyyy') rdate  ,to_char(current_date,'dd/mm/yyyy') cur_date,site ,program ,requester from registry.order where id  = ${order}`)
    const orderData = getOrder.rows[0]
    const getProvider = await pool.query(`select person_id from clinlims.clinlims.provider p where id = ${orderData.requester}`)
    const getPatient = await pool.query(`select names,surname ,to_char(date_of_birth,'dd/mm/yyyy') dob,sex,nic  ,to_char(current_date,'dd/mm/yyyy')  from registry.patient where id  = ${orderData.patient}`)
    const patientData = getPatient.rows[0]
    const getOEPatient = await pool.query(`select id  from clinlims.patient where national_id::text  = '${patientData.nic}'::text order by id desc limit 1`)
    const getSamples = await pool.query(`select id, to_char(collection_date,'dd/mm/yyyy') collection_date, to_char(collection_date,'HH24:mi') collection_time,  sample_type ,collector , tests ,condition from registry.samples where order_id  = ${order}`)
    let sampleXml = "<?xml version='1.0' encoding='utf-8'?><samples>"+ getSamples.rows.map(orders =>
        `<sample sampleID='${orders.sample_type}' date='${orders.collection_date}' time='${orders.collection_time}' collector='${orders.collector}#${orders.id}#${order}' tests='${orders.tests}' testSectionMap='' testSampleTypeMap="" panels='' initialConditionIds='${orders.condition}'  sampleNatureId='1480'  />`
   ).join('')+"</samples>"
   const oePatientStatus = getOEPatient.rowCount == 0 ? 'ADD' : 'UPDATE';
   const OE_PatientID = oePatientStatus == 'UPDATE' ? getOEPatient.rows[0].id : '';
   const getAuthToken = await pool.query(`SELECT session_id cookie,csrf_token token FROM registry.auth_session`)
   let tokens = getAuthToken.rows[0]

      let body =  new URLSearchParams({
        currentDate: `${orderData.cur_date}`,
        'sampleOrderItems.labNo':`${orderData.labno}`,
        'sampleOrderItems.requestDate':`${orderData.rdate}`,
        'sampleOrderItems.receivedDateForDisplay': `${orderData.rdate}`,
        'sampleOrderItems.receivedTime': `${orderData.rtime}`,
        'sampleOrderItems.referringSiteId':`${orderData.site}`,
        'sampleOrderItems.referringSiteDepartmentId': `${orderData.ward == null ? '' : orderData.ward}`,
        'sampleOrderItems.program': `${orderData.program}`,
        'sampleOrderItems.providerPersonId': `${getProvider.rows[0]?.person_id}`,
        sampleXML: `${sampleXml}`,
        'patientProperties.patientUpdateStatus': `${oePatientStatus}`,
        'patientProperties.patientPK': `${OE_PatientID}`,
        'patientProperties.subjectNumber': `reg-${orderData.patient}`,
        'patientProperties.nationalId': `${patientData.nic}`,
        'patientProperties.lastName': `${patientData.surname}`,
        'patientProperties.firstName':  `${patientData.names}`,
        'patientProperties.birthDateForDisplay': `${patientData.dob}`,
        'patientProperties.gender': `${patientData.sex}`,
        _csrf:  `${tokens.token}`
      })
      // sampleOrderItems.providerPersonId
    const options = {
      agent: httpsAgent,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        cookie: `${tokens.cookie}`
      },
      body
    };

   console.log(body)
  //  console.log(tokens)

    let createOrder =  await fetch(`https://${OE_HOST}/OpenELIS-Global/SamplePatientEntry`, options)

    let status = await createOrder.text()
    // console.log(status.split('<div id="successMsg" style="text-align: center; color: seagreen; width: 100%; font-size: 170%; visibility: ')[1].split(';'))}
  // console.log(status.split('<div id="successMsg" style="text-align: center; color: seagreen; width: 100%; font-size: 170%; visibility: ')[1])
    if(createOrder.ok){
      validate(order)
    }

}

async function validate(oid){
  // let addOrderToStatusQueue = await pool.query(`insert into oe_import(order_id)values(${oid})`)


  let orderData = {id:'',sample_ids:[]}
  let status = {
    order:false,
    patient:false,
    samples:[]
  }



  let querie = await pool.query(`select
  o.id orders, o.labno,
  p.id patient,
  array_agg(s.id) samples
  from
  registry."order" o
  join registry.patient p on o.patient = p.id
  join registry.samples s on s.order_id = o.id
  where o.id = ${oid}
  group by o.id,p.id`)
   let ids = querie.rows[0]
   console.log(ids)

   let findOrder = await pool.query(`select collector from sample s
  join sample_item si on si.samp_id = s.id  where accession_number = '${ids.labno}'`)
  // let splitOrder = findOrder.rows[0].collector.split('#')
    if(findOrder.rowCount > 0 ){

      findOrder.rows.forEach(row=>{

          if(row.collector.includes('#')){
            let slitData = row.collector.split('#')
            orderData.id = slitData[slitData.length-1]
            orderData.sample_ids.push(slitData[slitData.length-2])

          }


      })
      console.log(orderData)

    }


    // console.log(splitOrder[splitOrder.length-1],splitOrder[splitOrder.length-2])


  }


