import { useState, useEffect } from 'react';
import axios from 'axios';

interface HealthStatus {
  status: string;
  timestamp: string;
  database: string;
  message: string;
}

const Health = () => {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  useEffect(() => {
    const checkHealth = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get('/health');
        setHealthData(response.data);
      } catch (err) {
        console.error('Health check failed:', err);
        setError('Failed to connect to the backend service');
        setHealthData(null);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, [refreshCounter]);

  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'unhealthy':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-blue-600 px-6 py-4">
          <h1 className="text-white text-xl font-bold">Guardian System Health</h1>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          ) : healthData ? (
            <div>
              <div className="mb-6 text-center">
                <span className={`text-3xl font-bold ${getStatusColor(healthData.status)}`}>
                  {healthData.status.toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`font-medium ${getStatusColor(healthData.status)}`}>
                    {healthData.status}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Database:</span>
                  <span className={`font-medium ${healthData.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                    {healthData.database}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Message:</span>
                  <span className="font-medium text-gray-800">{healthData.message}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Last Checked:</span>
                  <span className="font-medium text-gray-800">{formatTimestamp(healthData.timestamp)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600">No health data available</div>
          )}
          
          <div className="mt-6">
            <button
              onClick={handleRefresh}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150"
            >
              Refresh Status
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Health;
