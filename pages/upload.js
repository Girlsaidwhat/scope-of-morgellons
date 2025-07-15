import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return setMessage('No file selected');

    // Get the currently signed-in user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return setMessage('You must be signed in to upload.');
    }

    const filePath = `${user.id}/${file.name}`;

    const { error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(error);
      setMessage('Upload failed.');
    } else {
      setMessage('Upload successful!');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Upload Image</h1>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <br />
      <button onClick={handleUpload} style={{ marginTop: '1rem' }}>
        Upload
      </button>
      <p>{message}</p>
    </div>
  );
}
