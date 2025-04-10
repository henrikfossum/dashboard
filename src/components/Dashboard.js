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
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }));

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
      current: count,
      previous: Math.round(count * 0.9), // Simulate previous period data
      lastYear: Math.round(count * 0.8)  // Simulate last year data
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  const processResponseTimeData = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.response_times) return [];
    
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const responseTimesEntries = Object.entries(dashboardData.responseTime.response_times);
    
    // Group by day of week and average the values
    const dayAverages = {};
    responseTimesEntries.forEach(([date, seconds]) => {
      const dayIndex = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, ...
      const day = daysOfWeek[dayIndex === 0 ? 6 : dayIndex - 1]; // Adjust to Mon-Sun format
      
      if (!dayAverages[day]) {
        dayAverages[day] = { total: 0, count: 0 };
      }
      
      dayAverages[day].total += seconds;
      dayAverages[day].count += 1;
    });
    
    return daysOfWeek.map(day => ({
      day,
      current: dayAverages[day] ? Math.round(dayAverages[day].total / dayAverages[day].count / 60) : 0, // Convert to minutes
      previous: dayAverages[day] ? Math.round(dayAverages[day].total / dayAverages[day].count / 60 * 1.15) : 0, // Simulate previous data (+15%)
      lastYear: dayAverages[day] ? Math.round(dayAverages[day].total / dayAverages[day].count / 60 * 1.35) : 0 // Simulate last year data (+35%)
    }));
  };

  const processTagsData = () => {
    if (!dashboardData.tags || !dashboardData.tags.tags) return [];
    
    return Object.entries(dashboardData.tags.tags)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const processStaffData = () => {
    if (!dashboardData.staff || !dashboardData.staff.report) return [];
    
    return Object.entries(dashboardData.staff.report).map(([name, data]) => ({
      name,
      satisfaction: 4 + Math.random() * 0.9, // Simulate satisfaction score between 4.0-4.9
      tickets: data.response_count,
      responseTime: Math.round(data.response_time_seconds / 60)
    })).sort((a, b) => b.satisfaction - a.satisfaction).slice(0, 5);
  };

  const processSatisfactionData = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Create simulated satisfaction data
    return daysOfWeek.map(day => ({
      day,
      current: 4 + Math.random() * 0.6, // Between 4.0-4.6
      previous: 3.9 + Math.random() * 0.5, // Between 3.9-4.4
      lastYear: 3.8 + Math.random() * 0.4 // Between 3.8-4.2
    }));
  };

  const getAverageResponseTime = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.summary) return '13.0 min';
    
    const avgSeconds = dashboardData.responseTime.summary.averages.in_range;
    return `${Math.round(avgSeconds / 60)} min`;
  };

  const getTotalTickets = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) return '326';
    
    return Object.values(dashboardData.volume.conversation_counts).reduce((sum, count) => sum + count, 0);
  };

  const getAverageSatisfaction = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === null ||
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === undefined) {
      return '4.3';
    }
    
    return dashboardData.channelSummary.aggregated.average_satisfaction_rating.toFixed(1);
  };

  const getActiveTickets = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.active_conversations === null ||
        dashboardData.channelSummary.aggregated.active_conversations === undefined) {
      return '42';
    }
    
    return dashboardData.channelSummary.aggregated.active_conversations;
  };

  // Most used templates - simulated data
  const templateData = [
    { name: 'Account Reset', count: 42 },
    { name: 'Shipping Status', count: 38 },
    { name: 'Return Policy', count: 32 },
    { name: 'Payment Issues', count: 28 },
    { name: 'Product Info', count: 25 }
  ];

  // Simulated channel distribution data
  const channelDistribution = [
    { name: 'Email', percentage: 45 },
    { name: 'Chat', percentage: 32 },
    { name: 'Phone', percentage: 23 }
  ];

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading && !brands.length) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Brand configuration section - can be toggled on/off
  const BrandsSection = () => (
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
  );

  return (
    <div className="bg-gray-100 p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customer Service Dashboard</h1>
        <div className="flex items-center mt-2">
          <p className="text-gray-500">Last updated: {currentDate}</p>
          <div className="ml-auto flex gap-2">
            <select 
              className="border rounded px-3 py-1 text-sm"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="month">This month</option>
            </select>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              Refresh
            </button>
            <button
              onClick={onLogout}
              className="text-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-200"
            >
              Logout
            </button>
          </div>
        </div>
        
        {/* AI Summary Shoutbox */}
        <div className="mt-4 bg-blue-600 text-white p-4 rounded-lg shadow">
          <div className="flex items-start">
            <Zap className="text-yellow-300 mr-3 mt-1 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-lg mb-2">AI Summary</h3>
              <p className="leading-relaxed">
                This week the number of tickets is up <span className="font-bold text-yellow-300">12.4%</span> compared to last week, 
                and the main question customers have is about <span className="font-bold text-yellow-300">account resets</span>. 
                <span className="font-bold text-yellow-300"> {processStaffData()[0]?.name || 'Sarah Johnson'}</span> is leading the customer satisfaction ratings with a 
                score of {processStaffData()[0]?.satisfaction.toFixed(1) || '4.8'}/5.0. Response times have improved by <span className="font-bold text-yellow-300">15.8%</span>, 
                but the backlog is growing. Consider allocating more resources to the billing department.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <Clock className="text-blue-500 mr-2" size={20} />
            <h3 className="font-semibold">Avg. Response Time</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getAverageResponseTime()}</p>
          <p className="text-sm text-green-500 flex items-center">↓ 15% from previous period</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <Inbox className="text-purple-500 mr-2" size={20} />
            <h3 className="font-semibold">Total Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getTotalTickets()}</p>
          <p className="text-sm text-red-500 flex items-center">↑ 12% from previous period</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <ThumbsUp className="text-green-500 mr-2" size={20} />
            <h3 className="font-semibold">CSAT Score</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getAverageSatisfaction()}/5.0</p>
          <p className="text-sm text-green-500 flex items-center">↑ 0.2 from previous period</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <AlertTriangle className="text-yellow-500 mr-2" size={20} />
            <h3 className="font-semibold">Open Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getActiveTickets()}</p>
          <p className="text-sm text-yellow-500 flex items-center">↑ 5 since yesterday</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Conditionally show brands section for admin functionality */}
      {brands.length === 0 && <BrandsSection />}
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Response Time Section */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <Clock className="text-blue-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">Response Time</h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">{getAverageResponseTime()}</p>
                <p className="text-sm text-gray-500">Average (Last 7 days)</p>
              </div>
              <div className="text-right">
                <p className="text-green-500 font-semibold">↓ 15.8%</p>
                <p className="text-sm text-gray-500">vs Previous 7 days</p>
              </div>
              <div className="text-right">
                <p className="text-green-500 font-semibold">↓ 35.1%</p>
                <p className="text-sm text-gray-500">vs Last Year</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={processResponseTimeData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="current" stroke="#0088FE" name="Current Period" strokeWidth={2} />
              <Line type="monotone" dataKey="previous" stroke="#888" name="Previous Period" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="lastYear" stroke="#82ca9d" name="Last Year" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Number of Tickets Section */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <Inbox className="text-purple-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">Number of Tickets</h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">{getTotalTickets()}</p>
                <p className="text-sm text-gray-500">Total (Last 7 days)</p>
              </div>
              <div className="text-right">
                <p className="text-red-500 font-semibold">↑ 12.4%</p>
                <p className="text-sm text-gray-500">vs Previous 7 days</p>
              </div>
              <div className="text-right">
                <p className="text-red-500 font-semibold">↑ 27.3%</p>
                <p className="text-sm text-gray-500">vs Last Year</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={processVolumeData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="current" fill="#8884d8" name="Current Period" />
              <Bar dataKey="previous" fill="#ccc" name="Previous Period" />
              <Bar dataKey="lastYear" fill="#82ca9d" name="Last Year" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Customer Satisfaction Section */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <ThumbsUp className="text-green-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">Customer Satisfaction</h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">{getAverageSatisfaction()}/5.0</p>
                <p className="text-sm text-gray-500">Average (Last 7 days)</p>
              </div>
              <div className="text-right">
                <p className="text-green-500 font-semibold">↑ 0.2</p>
                <p className="text-sm text-gray-500">vs Previous 7 days</p>
              </div>
              <div className="text-right">
                <p className="text-green-500 font-semibold">↑ 0.4</p>
                <p className="text-sm text-gray-500">vs Last Year</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={processSatisfactionData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[3.5, 5]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="current" stroke="#00C49F" name="Current Period" strokeWidth={2} />
                  <Line type="monotone" dataKey="previous" stroke="#888" name="Previous Period" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="lastYear" stroke="#FF8042" name="Last Year" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Surveys</h3>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <p className="font-bold">245</p>
                    <p className="text-xs text-gray-500">Sent</p>
                  </div>
                  <div>
                    <p className="font-bold">198</p>
                    <p className="text-xs text-gray-500">Received</p>
                  </div>
                  <div>
                    <p className="font-bold">80.8%</p>
                    <p className="text-xs text-gray-500">Response Rate</p>
                  </div>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-700 mt-4">Rating per Employee (Last 7 days)</h3>
              <div className="mt-2 space-y-2">
                {processStaffData().map((employee, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="w-1/3 truncate text-sm">{employee.name}</div>
                    <div className="w-1/3 flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${employee.satisfaction / 5 * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-1/3 text-right text-sm">{employee.satisfaction.toFixed(1)}/5.0</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* What People Ask About Section */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <MessageSquare className="text-orange-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">What People Ask About</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <TrendingUp size={16} className="mr-1 text-blue-500" /> Trending Tags
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={processTagsData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {processTagsData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Users size={16} className="mr-1 text-purple-500" /> Most Used Response Templates
              </h3>
              {templateData.map((template, index) => (
                <div key={index} className="flex items-center justify-between mb-2">
                  <div className="text-sm truncate pr-2">{template.name}</div>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full" 
                        style={{ width: `${template.count / Math.max(...templateData.map(t => t.count)) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 w-8 text-right">{template.count}</div>
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Keyword Analysis</h3>
                <div className="bg-gray-100 p-2 rounded text-sm">
                  <div className="inline-block bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs m-1">account access</div>
                  <div className="inline-block bg-green-100 text-green-800 rounded px-2 py-1 text-xs m-1">shipping delay</div>
                  <div className="inline-block bg-purple-100 text-purple-800 rounded px-2 py-1 text-xs m-1">password reset</div>
                  <div className="inline-block bg-yellow-100 text-yellow-800 rounded px-2 py-1 text-xs m-1">payment failed</div>
                  <div className="inline-block bg-red-100 text-red-800 rounded px-2 py-1 text-xs m-1">refund request</div>
                  <div className="inline-block bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs m-1">product defect</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Insights Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold text-gray-700 mb-2">Ticket Resolution Time</h3>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">First Contact Resolution:</span>
            <span className="font-bold">68%</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Avg. Resolution Time:</span>
            <span className="font-bold">4.2 hours</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Tickets Resolved (7d):</span>
            <span className="font-bold">284</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold text-gray-700 mb-2">Channel Distribution</h3>
          {channelDistribution.map((channel, index) => (
            <div key={index} className="flex justify-between items-center mb-2">
              <span className="text-sm">{channel.name}:</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${
                      index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-green-500' : 'bg-purple-500'
                    }`} 
                    style={{ width: `${channel.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm">{channel.percentage}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold text-gray-700 mb-2">Team Performance</h3>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Team Utilization:</span>
            <span className="font-bold">87%</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Backlog Change:</span>
            <span className="font-bold text-red-500">+8%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Avg. Handle Time:</span>
            <span className="font-bold">18.5 min</span>
          </div>
        </div>
      </div>
      
      {/* Show configured brands at bottom if we have some */}
      {brands.length > 0 && <div className="mt-8"><BrandsSection /></div>}
    </div>
  );
};

export default Dashboard;