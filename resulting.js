import https from 'https';


const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

import pool from './pool.js';
let OE_HOST = process.env.OE_HOST
import 'dotenv/config';
import fetch from 'node-fetch';
export async function pushResults(barcode,result,test,sample){
    const getresInfo = await pool.query(`select * from 
    (select 
    distinct a.id analysis,
    coalesce ( r.id::text, '') resultid,
    (select tst_rslt_type from clinlims.clinlims.test_result where test_id = '${test}'::int 
order by id desc limit 1) as res_type,
    a.test_id ,
    to_char(current_date,'DD/MM/YYYY') currdate,
    s.sample
    from 
    (select  unnest(string_to_array(tests,',' ))::int test , order_id ,id sample from registry.samples )  s   
    join registry."order" o on o.id = s.order_id 
    join clinlims.clinlims.sample_item si on si.collector like '%#'||s.sample||'#'||o.id
    join clinlims.clinlims.analysis a on a.sampitem_id = si.id
    left join clinlims.clinlims."result" r on r.analysis_id = a.id
    left join clinlims.clinlims.result_limits rl on rl.test_id = a.test_id
    ) bb
    where bb.test_id = '${test}'::int
    and bb.sample =  '${sample}'::int
    `)

    const orderData = getresInfo.rows[0]
    if(getresInfo.rowCount > 0){

      const getAuthToken = await pool.query(`SELECT session_id cookie,csrf_token token FROM registry.auth_session`)
      let tokens = getAuthToken.rows[0]
      
      let body = new URLSearchParams({
        accessionNumber: '',
        'paging.currentPage': '1',
        'testResult[0].accessionNumber': `${barcode}`,
        'testResult[0].isModified': 'true',
        'testResult[0].analysisId': `${orderData.analysis}`,
        'testResult[0].resultId': `${orderData.resultid}`,
        'testResult[0].testId': `${orderData.test_id}`,
        'testResult[0].technicianSignatureId': '',
        'testResult[0].testKitId': '',
        'testResult[0].resultLimitId': '',
        'testResult[0].resultType': `${orderData.res_type}`,
        'testResult[0].testMethod': ['', ''],
        'testResult[0].valid': 'true',
        'testResult[0].defaultResultValue': `${result}`,
        'testResult[0].referralId': '',
        'testResult[0].referralCanceled': 'false',
        'testResult[0].considerRejectReason': '',
        'testResult[0].hasQualifiedResult': 'false',
        'testResult[0].shadowResultValue': `${result}`,
        'testResult[0].testDate': `${orderData.currdate}`,
        '_testResult[0].analysisMethod': 'on',
        '_testResult[0].forceTechApproval': 'on',
        'testResult[0].resultValue': `${result}`,
        'testResult[0].qualifiedResultValue': '',
        hideShowFlag: 'hidden',
        'testResult[0].rejectReasonId': '0',
        'testResult[0].note': `${orderData.resultid == '' ? '' : Date.now()+' External result'}`,
        '_testResult[0].refer': 'on',
        _csrf: `${tokens.token}`
      })
      let firstFetch = await fetch(`https://${OE_HOST}/OpenELIS-Global/AccessionResults?accessionNumber=${barcode}`,
      {agent: httpsAgent,
        method: 'GET' , headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        cookie: `${tokens.cookie}`
      }})

      if(firstFetch.ok){
        const options = {
          agent: httpsAgent,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            cookie: `${tokens.cookie}`
          },
          body
        };
  
        // console.log(body)
      //  console.log(tokens)
  
        let createOrder =  await fetch(`https://${OE_HOST}/OpenELIS-Global/AccessionResults?accessionNumber=${barcode}`, options)
  
        if(createOrder.ok){
          console.log('post completed. please verify for barcode: '+barcode)
        }else if(createOrder.status == 500){
          console.log('got 500 during resulting ',barcode)
        }

      }
      else if(firstFetch.status == 500){
        console.log('got 500 during token testing ',barcode)
      }
    }else{
        console.log('no barcode:'+barcode+' in samples on oe')
    }

}


