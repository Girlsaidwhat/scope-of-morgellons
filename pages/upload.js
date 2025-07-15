import { useState } from 'react';
import { uploadImage } from '../utils/uploadImage';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const userId = 'test-user'; // 🔐 Replace this with the logged-in user's ID once auth is set up

  const handleUpload = async () => {
    if (!file) {
      setStatus('Please select a file to upload.');
      return;
    }

    try {
      setStatus('Uploading...');
      const path = await uploadImage(file, userId);
      setStatus(`Upload successful! File path: ${path}`);
    } catch (error) {
      setStatus('Upload failed: ' + error.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload Microscopy Image</h1>
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
      <br />
      <button onClick={handleUpload} style={{ marginTop: 10 }}>
        Upload
      </button>
      <p>{status}</p>
    </div>
  );
}
