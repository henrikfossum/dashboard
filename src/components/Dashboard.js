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

  // Process data for charts - using only real data
  const processVolumeData = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) return [];
    
    // Convert to array format for the chart
    return Object.entries(dashboardData.volume.conversation_counts)
      .map(([date, count]) => ({
        date,
        count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const processResponseTimeData = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.response_times) return [];
    
    // Convert to array format for the chart and convert seconds to hours
    return Object.entries(dashboardData.responseTime.response_times)
      .map(([date, seconds]) => ({
        date,
        hours: (seconds / 3600).toFixed(2) // Convert seconds to hours with 2 decimal places
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  

  const processTagsData = () => {
    if (!dashboardData.tags || !dashboardData.tags.tags) return [];
    
    const excludedTags = [
      'Auto Reply', '💎 VIP', 'Pre-order', 'Order Edited', 'No AI', 
      'AI Error', 'Other', 'Chatbot', 'Auto Resolved', 'Chatbot solved', 'Out of Office', 'Spam',
      'Returns - ParcelFeeder', 'Returns - ColliFlow', '✨ Auto Reply', 'Out Of Office', 'chatbot'
    ];
    
    // Create a case-insensitive exclusion check
    const isExcluded = (tagName) => {
      // Check exact match first
      if (excludedTags.includes(tagName)) return true;
      
      // Then check case-insensitive match
      return excludedTags.some(excluded => 
        tagName.toLowerCase() === excluded.toLowerCase() ||
        tagName.toLowerCase().includes('auto') ||
        tagName.toLowerCase().includes('chatbot') ||
        tagName.toLowerCase().includes('office')
      );
    };
    
    return Object.entries(dashboardData.tags.tags)
      .filter(([name]) => !isExcluded(name))
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const processStaffData = () => {
    if (!dashboardData.staff || !dashboardData.staff.report) return [];
    
    return Object.entries(dashboardData.staff.report)
      .map(([name, data]) => ({
        name,
        responseCount: data.response_count || 0,
        appreciations: data.appreciations_count || 0,
        responseTime: data.response_time_seconds ? Math.round(data.response_time_seconds / 60) : 0
      }))
      .sort((a, b) => b.responseCount - a.responseCount)
      .slice(0, 5);
  };

  const processChannelData = () => {
    if (!dashboardData.channelSummary || !dashboardData.channelSummary.channels) return [];
    
    const channels = dashboardData.channelSummary.channels;
    const channelTypes = {};
    
    // Group by channel type
    Object.values(channels).forEach(channelData => {
      if (channelData.channel && channelData.channel.channel_type_name) {
        const typeName = channelData.channel.channel_type_name;
        if (!channelTypes[typeName]) {
          channelTypes[typeName] = {
            name: typeName,
            active: 0,
            total: 0
          };
        }
        channelTypes[typeName].active += channelData.active_conversations || 0;
        channelTypes[typeName].total += (channelData.active_conversations || 0) + 
                                        (channelData.resolved_conversations || 0) + 
                                        (channelData.archived_conversations || 0);
      }
    });
    
    // Convert to array and calculate percentages
    const totalConversations = Object.values(channelTypes).reduce((sum, channel) => sum + channel.total, 0);
    return Object.values(channelTypes).map(channel => ({
      name: channel.name,
      percentage: totalConversations > 0 ? Math.round(channel.total / totalConversations * 100) : 0,
      active: channel.active
    }));
  };

  const getAverageResponseTime = () => {
    if (!dashboardData.responseTime || 
        !dashboardData.responseTime.summary || 
        !dashboardData.responseTime.summary.averages) {
      return 'N/A';
    }
    
    const avgSeconds = dashboardData.responseTime.summary.averages.in_range;
    if (avgSeconds < 60) return `${avgSeconds} sec`;
    if (avgSeconds < 3600) return `${Math.round(avgSeconds / 60)} min`;
    return `${(avgSeconds / 3600).toFixed(2)} hr`; // Show in hours with 2 decimal places
  };

  const getResponseTimeChange = () => {
    if (!dashboardData.responseTime || 
        !dashboardData.responseTime.summary || 
        !dashboardData.responseTime.summary.trends ||
        !dashboardData.responseTime.summary.trends.last_7_days) {
      return null;
    }
    
    const changeRate = dashboardData.responseTime.summary.trends.last_7_days.change_rate;
    const percentChange = Math.abs(Math.round(changeRate * 100));
    
    return {
      value: `${percentChange}%`,
      isImprovement: changeRate < 0 // Negative change rate is good for response time
    };
  };

  const getTotalTickets = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) {
      return 'N/A';
    }
    
    return Object.values(dashboardData.volume.conversation_counts).reduce((sum, count) => sum + count, 0);
  };

  const getAverageSatisfaction = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === undefined ||
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === null) {
      return 'N/A';
    }
    
    return dashboardData.channelSummary.aggregated.average_satisfaction_rating.toFixed(1);
  };

  const getActiveTickets = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.active_conversations === undefined) {
      return 'N/A';
    }
    
    return dashboardData.channelSummary.aggregated.active_conversations;
  };

  // Generate summary based only on real data
  const generateSummary = () => {
    const responseTimeChange = getResponseTimeChange();
    const topTags = processTagsData();
    const topStaff = processStaffData();
    
    const mainQuestion = topTags.length > 0 ? topTags[0].name : 'various issues';
    const topPerformer = topStaff.length > 0 ? topStaff[0].name : 'the support team';
    
    return (
      <span>
        {topTags.length > 0 && (
          <>The main question customers have is about <span className="font-bold text-yellow-300">{mainQuestion}</span>. </>
        )}
        
        {topStaff.length > 0 && (
          <><span className="font-bold text-yellow-300">{topPerformer}</span> has the highest number of responses. </>
        )}
        
        {responseTimeChange && (
          <>
            Response times have{' '}
            <span className="font-bold text-yellow-300">
              {responseTimeChange.isImprovement ? 'improved' : 'increased'} by {responseTimeChange.value}
            </span>.{' '}
          </>
        )}
        
        {getActiveTickets() !== 'N/A' && (
          <>
            Currently <span className="font-bold text-yellow-300">{getActiveTickets()}</span> active tickets 
            require attention.
          </>
        )}
      </span>
    );
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
        
        {/* Summary Box - Using only real data */}
        <div className="mt-4 bg-blue-600 text-white p-4 rounded-lg shadow">
          <div className="flex items-start">
            <Zap className="text-yellow-300 mr-3 mt-1 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-lg mb-2">Dashboard Summary</h3>
              <p className="leading-relaxed">
                {generateSummary()}
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
          {getResponseTimeChange() && (
            <p className={`text-sm ${getResponseTimeChange().isImprovement ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {getResponseTimeChange().isImprovement ? '↓' : '↑'} {getResponseTimeChange().value} from previous period
            </p>
          )}
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <Inbox className="text-purple-500 mr-2" size={20} />
            <h3 className="font-semibold">Total Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getTotalTickets()}</p>
          <p className="text-sm text-gray-500">For selected period</p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <ThumbsUp className="text-green-500 mr-2" size={20} />
            <h3 className="font-semibold">CSAT Score</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getAverageSatisfaction()}/5.0</p>
          <p className="text-sm text-gray-500">Based on customer ratings</p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <AlertTriangle className="text-yellow-500 mr-2" size={20} />
            <h3 className="font-semibold">Open Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getActiveTickets()}</p>
          <p className="text-sm text-yellow-500 flex items-center">Require attention</p>
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
                <p className="text-sm text-gray-500">Average ({dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'This month'})</p>
              </div>
              {getResponseTimeChange() && (
                <div className="text-right">
                  <p className={getResponseTimeChange().isImprovement ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                    {getResponseTimeChange().isImprovement ? '↓' : '↑'} {getResponseTimeChange().value}
                  </p>
                  <p className="text-sm text-gray-500">vs Previous period</p>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
          <LineChart data={processResponseTimeData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => [`${value} hr`, 'Response Time']} />
            <Legend />
            <Line type="monotone" dataKey="hours" stroke="#0088FE" name="Response Time (hours)" strokeWidth={2} />
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
                <p className="text-sm text-gray-500">Total ({dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'This month'})</p>
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
              <Bar dataKey="count" fill="#8884d8" name="Tickets" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Staff Performance Section - Using only real data */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <Users className="text-green-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">Staff Performance</h2>
          </div>
          
          {processStaffData().length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1 px-1">
                <span>Staff Member</span>
                <div className="flex space-x-4">
                  <span className="w-20 text-right">Responses</span>
                  <span className="w-20 text-right">Appreciations</span>
                  <span className="w-20 text-right">Avg. Time</span>
                </div>
              </div>
              
              {processStaffData().map((staff, index) => (
                <div key={index} className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{staff.name}</span>
                    <div className="flex space-x-4">
                      <span className="w-20 text-right">{staff.responseCount}</span>
                      <span className="w-20 text-right">{staff.appreciations}</span>
                      <span className="w-20 text-right">{staff.responseTime} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No staff data available
            </div>
          )}
        </div>
        
        {/* What People Ask About Section - Using only real tag data */}
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
              {processTagsData().length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={processTagsData()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => {
                        // Truncate long names to prevent overlap
                        const shortName = name.length > 12 ? name.substring(0, 10) + '...' : name;
                        return `${shortName} ${(percent * 100).toFixed(0)}%`;
                      }}
                    >
                      {processTagsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend layout="vertical" verticalAlign="bottom" align="center" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No tag data available
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Users size={16} className="mr-1 text-purple-500" /> Top Tags by Volume
              </h3>
              {processTagsData().length > 0 ? (
                processTagsData().map((tag, index) => (
                  <div key={index} className="flex items-center justify-between mb-2">
                    <div className="text-sm truncate pr-2">{tag.name}</div>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${tag.value / Math.max(...processTagsData().map(t => t.value)) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 w-8 text-right">{tag.value}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  No tag data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Additional sections removed as requested */}
      
      {/* Show configured brands at bottom if we have some */}
      {brands.length > 0 && <div className="mt-8"><BrandsSection /></div>}
    </div>
  );
};

export default Dashboard;