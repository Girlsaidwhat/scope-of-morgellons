import { useState } from 'react';
import { uploadImage } from '../utils/uploadImage';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const userId = 'test-user'; // 🔐 Replace with actual user ID when auth is ready

  const handleUpload = async () => {
    if (!file) {
      setStatus('Please select or drop an image.');
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

  const handleDrop = (e) => {
    e.preventDefault();
    setFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload Microscopy Image</h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
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
          capture="environment"
          onChange={handleFileChange}
        />
      </div>

      <button onClick={handleUpload}>Upload</button>

      <p style={{ marginTop: 20 }}>{status}</p>
    </div>
  );
}
