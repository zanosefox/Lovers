const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase client for Auth and Storage.
 * Uses service_role key for server-side operations (bypasses RLS).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Public client (respects RLS — for client-side operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (bypasses RLS — for server-side operations)
const supabaseAdmin = supabaseServiceKey && supabaseServiceKey !== 'PASTE_SERVICE_ROLE_KEY_HERE'
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

if (!supabaseAdmin) {
  console.log('⚠️ Supabase service key not configured — admin operations disabled');
}

// ============================================
// 📦 Storage Helpers
// ============================================

/**
 * Upload a file to Supabase Storage
 * @param {String} bucket - Bucket name (e.g. 'avatars', 'posts')
 * @param {String} filePath - Path inside bucket (e.g. 'user123/photo.jpg')
 * @param {Buffer} buffer - File data
 * @param {String} contentType - MIME type
 * @returns {Promise<{publicUrl, path}>}
 */
const uploadToStorage = async (bucket, filePath, buffer, contentType = 'image/jpeg') => {
  const client = supabaseAdmin || supabase;
  const { data, error } = await client.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = client.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    publicUrl: publicUrlData.publicUrl,
    path: data.path
  };
};

/**
 * Delete a file from Supabase Storage
 * @param {String} bucket
 * @param {String} filePath
 */
const deleteFromStorage = async (bucket, filePath) => {
  const client = supabaseAdmin || supabase;
  const { error } = await client.storage
    .from(bucket)
    .remove([filePath]);

  if (error) throw error;
};

/**
 * Get public URL for a stored file
 * @param {String} bucket
 * @param {String} filePath
 * @returns {String}
 */
const getStorageUrl = (bucket, filePath) => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
};

// ============================================
// 🪣 Bucket Management
// ============================================

/**
 * Ensure a storage bucket exists (creates it if not)
 * @param {String} bucketName
 * @param {Boolean} isPublic
 */
const ensureBucket = async (bucketName, isPublic = true) => {
  if (!supabaseAdmin) return;

  // Check if bucket exists
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets && buckets.find(b => b.id === bucketName);

  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: isPublic
    });
    if (error) {
      console.error(`❌ Failed to create bucket ${bucketName}:`, error.message);
    } else {
      console.log(`✅ Storage bucket "${bucketName}" created`);
    }
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  uploadToStorage,
  deleteFromStorage,
  getStorageUrl,
  ensureBucket
};
