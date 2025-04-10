import React, { useState } from 'react';

const BrandForm = ({ token, onBrandAdded, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add brand');
      }

      onBrandAdded(data);
      setFormData({
        name: '',
        url: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract subdomain from full URL 
  const extractSubdomain = (url) => {
    if (!url) return '';
    
    try {
      // If user enters full URL, extract just the subdomain
      if (url.includes('reamaze.io')) {
        const match = url.match(/^(?:https?:\/\/)?([^.]+)\.reamaze\.io/);
        return match ? match[1] : url;
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Add New Re:Amaze Brand</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            Brand Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
            placeholder="My Company Support"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="url">
            Re:Amaze Subdomain
          </label>
          <div className="flex items-center">
            <input
              id="url"
              name="url"
              type="text"
              value={formData.url}
              onChange={(e) => {
                const cleanedUrl = extractSubdomain(e.target.value);
                setFormData({...formData, url: cleanedUrl});
              }}
              className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              placeholder="mycompany"
            />
            <span className="bg-gray-200 py-2 px-3 text-gray-700 rounded-r">.reamaze.io</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter just the subdomain part, e.g. "mycompany" for mycompany.reamaze.io
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Brand'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BrandForm;