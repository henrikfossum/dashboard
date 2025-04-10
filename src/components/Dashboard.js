import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, Inbox, ThumbsUp, MessageSquare, TrendingUp, Users, AlertTriangle, Zap, Plus, X } from 'lucide-react';
import BrandForm from './BrandForm';

const Dashboard = ({ onLogout, token }) => {
  const [brands, setBrands] = useState([]);
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    channelSummary: null,
    tags: null,
    staff: null,
    responseTime: null,
    volume: null
  });
  const [error, setError] = useState(null);

  // Fetch brands on component mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setError(null);
        const response = await fetch('/api/brands', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch brands');
        }

        const data = await response.json();
        setBrands(data);
      } catch (error) {
        console.error('Error fetching brands:', error);
        setError('Failed to load brands. Please check your connection and try again.');
      }
    };

    fetchBrands();
  }, [token]);

  // Fetch dashboard data when date range changes
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Calculate date range
        const endDate = new Date().toISOString().split('T')[0];
        let startDate;
        
        if (dateRange === '7d') {
          const date = new Date();
          date.setDate(date.getDate() - 7);
          startDate = date.toISOString().split('T')[0];
        } else if (dateRange === '30d') {
          const date = new Date();
          date.setDate(date.getDate() - 30);
          startDate = date.toISOString().split('T')[0];
        } else if (dateRange === 'month') {
          const date = new Date();
          date.setDate(1);
          startDate = date.toISOString().split('T')[0];
        }

        // Fetch all reports in parallel
        const [channelRes, tagsRes, staffRes, responseTimeRes, volumeRes] = await Promise.all([
          fetch(`/api/channel-summary?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/tags?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/staff?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/response-time?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/volume?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        // Check if any requests failed
        if (!channelRes.ok || !tagsRes.ok || !staffRes.ok || !responseTimeRes.ok || !volumeRes.ok) {
          throw new Error('Failed to fetch some data from Re:Amaze API');
        }

        // Process responses
        const channelData = await channelRes.json();
        const tagsData = await tagsRes.json();
        const staffData = await staffRes.json();
        const responseTimeData = await responseTimeRes.json();
        const volumeData = await volumeRes.json();

        setDashboardData({
          channelSummary: channelData,
          tags: tagsData,
          staff: staffData,
          responseTime: responseTimeData,
          volume: volumeData
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange, token]);

  const handleAddBrand = (newBrand) => {
    setBrands([...brands, newBrand]);
    setShowAddBrand(false);
  };

  const handleDeleteBrand = async (id) => {
    if (window.confirm('Are you sure you want to remove this brand?')) {
      try {
        const response = await fetch(`/api/brands/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete brand');
        }

        // Remove brand from state
        setBrands(brands.filter(brand => brand.id !== id));
      } catch (error) {
        console.error('Error deleting brand:', error);
        alert('Failed to delete brand. Please try again.');
      }
    }
  };

  // Process data for charts
  const processVolumeData = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) return [];
    
    return Object.entries(dashboardData.volume.conversation_counts).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  const processResponseTimeData = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.response_times) return [];
    
    return Object.entries(dashboardData.responseTime.response_times).map(([date, seconds]) => ({
      date,
      minutes: Math.round(seconds / 60)
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  const processTagsData = () => {
    if (!dashboardData.tags || !dashboardData.tags.tags) return [];
    
    return Object.entries(dashboardData.tags.tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const processStaffData = () => {
    if (!dashboardData.staff || !dashboardData.staff.report) return [];
    
    return Object.entries(dashboardData.staff.report).map(([name, data]) => ({
      name,
      responseCount: data.response_count,
      responseTime: Math.round(data.response_time_seconds / 60),
      appreciations: data.appreciations_count
    })).sort((a, b) => b.responseCount - a.responseCount);
  };

  const getAverageResponseTime = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.summary) return 'N/A';
    
    const avgSeconds = dashboardData.responseTime.summary.averages.in_range;
    if (avgSeconds < 60) return `${avgSeconds} sec`;
    
    return `${Math.round(avgSeconds / 60)} min`;
  };

  const getTotalTickets = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) return 'N/A';
    
    return Object.values(dashboardData.volume.conversation_counts).reduce((sum, count) => sum + count, 0);
  };

  const getAverageSatisfaction = () => {
    if (!dashboardData.channelSummary || !dashboardData.channelSummary.aggregated) return 'N/A';
    
    return dashboardData.channelSummary.aggregated.average_satisfaction_rating.toFixed(1);
  };

  const getActiveTickets = () => {
    if (!dashboardData.channelSummary || !dashboardData.channelSummary.aggregated) return 'N/A';
    
    return dashboardData.channelSummary.aggregated.active_conversations;
  };

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading && !brands.length) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Re:Amaze Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            <div>
              <select 
                className="border rounded px-3 py-1 text-sm"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="month">This month</option>
              </select>
            </div>
            
            <button
              onClick={onLogout}
              className="px-3 py-1 text-sm text-gray-700 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Brands management */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Configured Brands</h2>
            <button 
              onClick={() => setShowAddBrand(!showAddBrand)}
              className="flex items-center text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
            >
              {showAddBrand ? <X size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
              {showAddBrand ? 'Cancel' : 'Add Brand'}
            </button>
          </div>

          {showAddBrand && (
            <div className="mb-4">
              <BrandForm token={token} onBrandAdded={handleAddBrand} onCancel={() => setShowAddBrand(false)} />
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-4">
            {brands.length === 0 ? (
              <p className="text-gray-500">No brands configured. Add your first Re:Amaze brand to start.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map(brand => (
                  <div key={brand.id} className="border rounded p-3 relative">
                    <button 
                      onClick={() => handleDeleteBrand(brand.id)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                    <h3 className="font-medium mb-1">{brand.name}</h3>
                    <p className="text-sm text-gray-500">{brand.url}.reamaze.io</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-10">
            <div className="text-xl">Loading dashboard data...</div>
          </div>
        ) : (
          <>
            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded shadow">
                <div className="flex items-center">
                  <Clock className="text-blue-500 mr-2" size={20} />
                  <h3 className="font-semibold">Avg. Response Time</h3>
                </div>
                <p className="text-3xl font-bold mt-2">{getAverageResponseTime()}</p>
              </div>
              
              <div className="bg-white p-4 rounded shadow">
                <div className="flex items-center">
                  <Inbox className="text-purple-500 mr-2" size={20} />
                  <h3 className="font-semibold">Total Tickets</h3>
                </div>
                <p className="text-3xl font-bold mt-2">{getTotalTickets()}</p>
              </div>
              
              <div className="bg-white p-4 rounded shadow">
                <div className="flex items-center">
                  <ThumbsUp className="text-green-500 mr-2" size={20} />
                  <h3 className="font-semibold">CSAT Score</h3>
                </div>
                <p className="text-3xl font-bold mt-2">{getAverageSatisfaction()}/5.0</p>
              </div>
              
              <div className="bg-white p-4 rounded shadow">
                <div className="flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-2" size={20} />
                  <h3 className="font-semibold">Active Tickets</h3>
                </div>
                <p className="text-3xl font-bold mt-2">{getActiveTickets()}</p>
              </div>
            </div>
            
            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Response Time Section */}
              <div className="bg-white p-6 rounded shadow">
                <div className="flex items-center mb-4">
                  <Clock className="text-blue-500 mr-2" size={20} />
                  <h2 className="text-xl font-bold">Response Time</h2>
                </div>
                
                <div className="h-64">
                  {processResponseTimeData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processResponseTimeData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="minutes" stroke="#0088FE" name="Response Time (minutes)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No data available
                    </div>
                  )}
                </div>
              </div>
              
              {/* Number of Tickets Section */}
              <div className="bg-white p-6 rounded shadow">
                <div className="flex items-center mb-4">
                  <Inbox className="text-purple-500 mr-2" size={20} />
                  <h2 className="text-xl font-bold">Number of Tickets</h2>
                </div>
                
                <div className="h-64">
                  {processVolumeData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processVolumeData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#8884d8" name="Tickets" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No data available
                    </div>
                  )}
                </div>
              </div>
              
              {/* Staff Performance */}
              <div className="bg-white p-6 rounded shadow">
                <div className="flex items-center mb-4">
                  <Users className="text-green-500 mr-2" size={20} />
                  <h2 className="text-xl font-bold">Staff Performance</h2>
                </div>
                
                {processStaffData().length > 0 ? (
                  <div className="space-y-4">
                    {processStaffData().slice(0, 5).map((staff, index) => (
                      <div key={index} className="border-b pb-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{staff.name}</span>
                          <span className="text-sm text-gray-600">{staff.responseCount} responses</span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Avg. Response Time:</span>
                            <span className="ml-1">{staff.responseTime} min</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Appreciations:</span>
                            <span className="ml-1">{staff.appreciations}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    No data available
                  </div>
                )}
              </div>
              
              {/* Trending Tags */}
              <div className="bg-white p-6 rounded shadow">
                <div className="flex items-center mb-4">
                  <MessageSquare className="text-orange-500 mr-2" size={20} />
                  <h2 className="text-xl font-bold">Trending Tags</h2>
                </div>
                
                <div className="h-64">
                  {processTagsData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={processTagsData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {processTagsData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No tag data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;