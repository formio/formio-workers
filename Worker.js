const { Worker, isMainThread, workerData, parentPort }  = require('worker_threads');

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
    const { VM } = require('vm2');
    const worker = require(workerData.task)(workerData.data);
    let output = '';
    try {
        output = (new VM({
            timeout: 15000,
            sandbox: worker.context,
            fixAsync: true
        })).run(worker.script);
    }
    catch (e) {
        console.log(e.message);
        console.log(e.stack);
        return parentPort.postMessage(e.message);
    }
    parentPort.postMessage((typeof output === 'string') ? output : JSON.parse(JSON.stringify(output)));
}