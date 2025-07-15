import { supabase } from './supabaseClient';

export async function uploadImage(file, userId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (error) {
    throw new Error('Upload failed: ' + error.message);
  }

  return data.path;
}
