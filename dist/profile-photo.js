export function captureProfilePhoto(video){
 if(!video.videoWidth||!video.videoHeight)throw new Error('Wait for the camera preview before capturing your photo.');
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Profile photo capture is unavailable in this browser.');
 const side=Math.min(video.videoWidth,video.videoHeight);ctx.translate(256,0);ctx.scale(-1,1);ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,256,256);return canvas.toDataURL('image/jpeg',.72);
}
