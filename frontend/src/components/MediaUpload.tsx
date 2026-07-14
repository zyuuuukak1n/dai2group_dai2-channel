import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { FileImage, Loader2, X } from 'lucide-react';

interface MediaUploadProps {
  onUploadSuccess: (url: string) => void;
  onClear: () => void;
}

export default function MediaUpload({ onUploadSuccess, onClear }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileType, setFileType] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('ファイルサイズは50MB以下にしてください。');
      return;
    }

    try {
      setIsUploading(true);
      setError('');
      
      // 1. Get presigned URL
      const { uploadUrl, publicUrl } = await apiFetch(`/media/presigned?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);

      // 2. Upload to S3 directly
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        }
      });

      if (!uploadRes.ok) throw new Error('アップロードに失敗しました');

      // 3. Success
      setPreviewUrl(publicUrl);
      setFileType(file.type);
      onUploadSuccess(publicUrl);

    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setIsUploading(false);
      // clear input
      e.target.value = '';
    }
  };

  const handleClear = () => {
    setPreviewUrl('');
    setFileType('');
    setError('');
    onClear();
  };

  return (
    <div className="space-y-2">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      
      {!previewUrl && (
        <div>
          <input 
            type="file" 
            id="media-upload" 
            style={{ display: 'none' }}
            accept="image/*,video/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <label 
            htmlFor="media-upload" 
            className={`btn bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center justify-center gap-2 cursor-pointer w-fit ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            {isUploading ? 'アップロード中...' : '画像・動画を添付'}
          </label>
        </div>
      )}

      {previewUrl && (
        <div className="relative inline-block border border-border rounded-md p-1 bg-gray-50">
          <button 
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
          >
            <X className="w-4 h-4" />
          </button>
          
          {fileType.startsWith('video/') ? (
            <video src={previewUrl} className="media-preview" controls />
          ) : (
            <img src={previewUrl} alt="Preview" className="media-preview" />
          )}
        </div>
      )}
    </div>
  );
}
