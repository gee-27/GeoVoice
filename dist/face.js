import {distance,matchesFace} from './core.js';
let models;
export async function loadModels(){
  if(!window.faceapi)throw new Error('Face recognition could not load. Refresh the page and try again.');
  models??=Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('./models'),faceapi.nets.faceLandmark68Net.loadFromUri('./models'),faceapi.nets.faceRecognitionNet.loadFromUri('./models')]).catch(e=>{models=null;throw new Error('Face models could not load. Check the models folder and refresh.');});
  return models;
}
export async function capture(video,count,onStep,cancelled){
  const samples=[];
  for(let i=0;i<count;i++){
    if(cancelled())throw new Error('Capture cancelled.');
    onStep(`Capture ${i+1} of ${count}: look at the camera and hold still.`);
    const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:.65})).withFaceLandmarks().withFaceDescriptors();
    if(cancelled())throw new Error('Capture cancelled.');
    if(detections.length!==1)throw new Error(detections.length?'Only one person should be in the camera frame.':'No clear face found. Face the camera, improve the light, and try again.');
    const d=detections[0];
    if(d.detection.box.width<100||d.detection.box.height<100)throw new Error('Move closer to the camera and try again.');
    const descriptor=Array.from(d.descriptor);
    if(samples.length&&distance(samples[0],descriptor)>.45)throw new Error('The captures did not match. Keep the same person in view and try again.');
    samples.push(descriptor);await new Promise(r=>setTimeout(r,400));
  }
  return samples;
}
export {matchesFace};
