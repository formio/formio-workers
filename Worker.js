'use strict';

const {Worker, isMainThread, workerData, parentPort}  = require('worker_threads');

if (isMainThread) {
    module.exports = (task, data) => {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(__filename, {workerData: JSON.parse(JSON.stringify({
                    task,
                    data
                }))});
                worker.on('message', (output) => {
                    worker.terminate();
                    return resolve(output);
                });
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    };
}
else {
    require(workerData.task)(workerData.data).then((output) => {
        parentPort.postMessage((typeof output === 'string') ? output : JSON.parse(JSON.stringify(output)));
    });
}
