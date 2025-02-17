import * as fs from 'node:fs/promises';
import { PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import {runJob} from "./lib/jobExec.js";

import config from '../config.json' with { type: 'json' };

const args = process.argv;
const expName = args[1].substring(args[1].lastIndexOf('/')+1);

const expArgs = args.slice(2);
const itemCount = expArgs.length > 0 ? expArgs[0] : 3000;

const operation = expArgs[1] || 'write';

const tableNames = ['MREC', 'MRSC'];

let summary = {

    itemCount: itemCount,

    desc: 'Comparing small item request latency for MREC and MRSC modes of DynamoDB Global Tables',
    type: 'Line',

    xAxisLabel: 'request',
    xAxisUnits: '#',
    xAttribute: 'requestNum',

    yAxisLabel: 'latency',
    yAxisUnits: 'ms',
    yAttribute: 'latency',

    operation: operation,
    expName: expName,
    expArgs: expArgs,

    charts: ['LA','HI'] // latency simple and histogram

};
console.log('Experiment Description : ' + summary['desc']);
console.log();

const run = async () => {
    const expName = 'E' + Math.floor(new Date().getTime() / 1000).toString();

    let params;
    let results;

    //  // *************************** Test MREC writes ***************************
    params = {
        experiment: expName, 
        test: 'MREC writes',
        operation: 'put', 
        targetTable: tableNames[0], items: summary.itemCount, 
        PK: 'PK', 
        SK: 'SK', 
        jobFile: 'load-smallitems.js'
    };

    results = await runJob(params);
    console.log('put : ' + params['items']);
    console.log();

    // // *************************** Test MRSC writes ***************************

    params = {
        experiment: expName, 
        test: 'MRSC writes',  
        operation: 'put',   
        targetTable: tableNames[1], items: summary.itemCount, 
        PK: 'PK', SK: 'SK', jobFile: 'load-smallitems.js',
    };

    results = await runJob(params);
    console.log('put : ' + params['items']);
    console.log();

    // *************************** Test MRSC default reads *****************

    params = {
        experiment: expName, 
        test: 'MRSC default reads', 
        operation: 'get',
        strength: 'default', 
        targetTable: tableNames[1], items: summary.itemCount, 
        PK: 'PK', SK: 'SK', jobFile: 'load-smallitems.js',
    };

    results = await runJob(params);
    console.log('got : ' + params['items']);
    console.log();

    // *************************** Test MRSC strong reads *****************

    params = {
        experiment: expName, 
        test: 'MRSC strong reads', 
        operation: 'get',
        strength: 'strong', 
        targetTable: tableNames[1], items: summary.itemCount, 
        PK: 'PK', SK: 'SK', jobFile: 'load-smallitems.js',
    };

    results = await runJob(params);
    console.log('got : ' + params['items']);
    console.log();



        // // *************************** Test MREC conditional writes ***************************
        // params = {
        //     experiment: expName, 
        //     test: 'MREC conditional writes',
        //     operation: 'put', 
        //     targetTable: tableNames[0], items: summary.itemCount, 
        //     PK: 'PK', SK: 'SK', jobFile: 'load-smallitems.js',
        //     conditionalWrite: 'true'
            
        // };
    
        // results = await runJob(params);
        // console.log('put : ' + params['items']);
        // console.log();
    
        // // *************************** Test MRSC conditional writes ***************************
    
        // params = {
        //     experiment: expName, 
        //     test: 'MRSC conditional writes',  
        //     operation: 'put',   
        //     targetTable: tableNames[1], items: summary.itemCount, 
        //     PK: 'PK', SK: 'SK', jobFile: 'load-smallitems.js',
        //     conditionalWrite: 'true'
        // };
    
        // results = await runJob(params);
        // console.log('put : ' + params['items']);
        // console.log();



    // *************************** Upload to S3 ***************************
    // put folder and file in S3

    const fileData = await fs.readFile( '../public/experiments/' +  params.experiment + '/data.csv', 'utf-8');

    const key = 'exp/' + expName + '/data.csv';
    const keySummary = 'exp/' + expName + '/summary.json';

    const client = new S3Client({});
    let command = null;

    async function uploader(objName, body) {

        command = new PutObjectCommand({
            Bucket: config['bucketName'],
            Key: objName,
            Body: body,
        });

        try {
            const response = await client.send(command);
            console.log('uploaded s3://' + config['bucketName'] + '/' + objName);
            // console.log('HTTP ' + response.$metadata.httpStatusCode + ' for s3://' + bucketName + '/' + key);
        } catch (caught) {
            console.error(JSON.stringify(caught, null, 2));
        }

    }

    const res = await uploader(key, fileData);

    const res2 = await uploader(keySummary, JSON.stringify(summary, null, 2));


};


void run().then(()=>{
    process.exit(1);
});