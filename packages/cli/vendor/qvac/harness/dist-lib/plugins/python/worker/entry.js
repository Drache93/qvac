import { workerData } from 'worker_threads';
import { defaultLoad, loadPyodideAddons } from '../loader.js';
import { serve } from './serve.js';
if (workerData?.preload === true) {
    await loadPyodideAddons();
}
else {
    await serve(defaultLoad);
}
