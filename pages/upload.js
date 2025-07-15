import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { uploadImage } from '../utils/uploadImage';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const webcamRef = useRef(null);
  const userId = 'test-user'; // Replace with actual logged-in user ID when ready

  const handleCapture = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();

    // Convert base64 image to Blob
    fetch(imageSrc)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(file);
        setCameraOn(false);
        setStatus('Photo captured. Ready to upload.');
      });
  }, [webcamRef]);

  const handleUpload = async () => {
    if (!file) {
      setStatus('Please select or capture an image first.');
      return;
    }

    try {
      setStatus('Uploading...');
      const path = await uploadImage(file, userId);
      setStatus(`✅ Upload successful: ${path}`);
    } catch (err) {
      setStatus(`❌ Upload failed: ${err.message}`);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload Microscopy Image</h1>

      {!cameraOn && (
        <>
          <div
            onDrop={e => {
              e.preventDefault();
              setFile(e.dataTransfer.files[0]);
            }}
            onDragOver={e => e.preventDefault()}
            style={{
              border: '2px dashed #999',
              padding: 40,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <p>Drag and drop an image here</p>
            <p>or</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <button onClick={() => setCameraOn(true)} style={{ marginRight: 10 }}>
            Take a Photo
          </button>

          <button onClick={handleUpload}>Upload</button>
        </>
      )}

      {cameraOn && (
        <>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'environment' }}
            style={{ width: '100%', maxWidth: 400 }}
          />
          <button onClick={handleCapture} style={{ marginTop: 10 }}>
            Capture Photo
          </button>
          <button onClick={() => setCameraOn(false)} style={{ marginLeft: 10 }}>
            Cancel
          </button>
        </>
      )}

      <p style={{ marginTop: 20 }}>{status}</p>

      {file && !cameraOn && (
        <div>
          <h3>Selected file:</h3>
          <p>{file.name}</p>
          <img
            src={URL.createObjectURL(file)}
            alt="Selected"
            style={{ maxWidth: '100%', maxHeight: 300, marginTop: 10 }}
          />
        </div>
      )}
    </div>
  );
}
