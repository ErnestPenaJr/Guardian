import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/invite/accept', {
        token,
        firstName,
        lastName,
        password
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">Invalid invite link.</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Accept Invite</h2>
      {success ? (
        <div className="text-green-600">Account created! Redirecting to login...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">First Name</label>
            <input type="text" className="w-full border rounded px-3 py-2" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="block mb-1 font-medium">Last Name</label>
            <input type="text" className="w-full border rounded px-3 py-2" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>
          <div>
            <label className="block mb-1 font-medium">Password</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <button type="submit" className="w-full bg-green-700 text-white py-2 rounded" disabled={loading}>{loading ? 'Submitting...' : 'Set Up Account'}</button>
        </form>
      )}
    </div>
  );
}
