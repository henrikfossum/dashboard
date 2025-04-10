import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { Clock, Inbox, ThumbsUp, MessageSquare, TrendingUp, Users, AlertTriangle, Zap, Plus, X, Bot, Award, Calendar } from 'lucide-react';
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
  // Add new state variables for optimization
  const [memoizedTagsData, setMemoizedTagsData] = useState([]);
  const [fetchTimeout, setFetchTimeout] = useState(null);
  const [activeTagIndex, setActiveTagIndex] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(true); // Set to true by default
  const [prevYearData, setPrevYearData] = useState({
    channelSummary: null,
    tags: null,
    staff: null,
    responseTime: null,
    volume: null
  });
  // New state for tracking chatbot and AI metrics
  const [chatbotMetrics, setChatbotMetrics] = useState({
    totalChatbotInteractions: 0,
    chatbotResolved: 0,
    chatbotResolutionRate: 0,
    previousYearResolutionRate: 0
  });
  const [aiMetrics, setAiMetrics] = useState({
    totalResolved: 0,
    aiResolved: 0, 
    aiResolutionRate: 0,
    previousYearAiResolutionRate: 0
  });

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

  // Replaced the previous period calculation with year-over-year
  const getYearOverYearDates = (currentStart, currentEnd) => {
    const startDate = new Date(currentStart);
    const endDate = new Date(currentEnd);
    
    // Go back exactly one year for both dates
    let prevYearStartDate = new Date(startDate);
    prevYearStartDate.setFullYear(prevYearStartDate.getFullYear() - 1);
    
    let prevYearEndDate = new Date(endDate);
    prevYearEndDate.setFullYear(prevYearEndDate.getFullYear() - 1);
    
    return {
      startDate: prevYearStartDate.toISOString().split('T')[0],
      endDate: prevYearEndDate.toISOString().split('T')[0]
    };
  };

  // Fetch dashboard data when date range changes or comparison mode toggles
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Clear any pending fetch
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
      
      setLoading(true);
      setError(null);
      
      const timeoutId = setTimeout(async () => {
        try {
          // Calculate current period date range
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
          } else if (dateRange === 'quarter') {
            const date = new Date();
            const month = date.getMonth();
            date.setMonth(month - (month % 3));
            date.setDate(1);
            startDate = date.toISOString().split('T')[0];
          } else if (dateRange === 'ytd') {
            const date = new Date();
            date.setMonth(0);
            date.setDate(1);
            startDate = date.toISOString().split('T')[0];
          }
  
          // Fetch current period data
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
  
          // Check for any errors in fetching data
          if (!channelRes.ok || !tagsRes.ok || !staffRes.ok || !responseTimeRes.ok || !volumeRes.ok) {
            throw new Error('Failed to fetch some data from Re:Amaze API');
          }

          // Process current period data
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
          
          // Process chatbot and AI metrics from current data
          processChatbotAndAiMetrics(tagsData, staffData);
          
          // If comparison mode is enabled, fetch year-over-year data
          if (comparisonMode) {
            const prevYear = getYearOverYearDates(startDate, endDate);
            
            try {
              const [prevYearChannelRes, prevYearTagsRes, prevYearStaffRes, prevYearResponseTimeRes, prevYearVolumeRes] = await Promise.all([
                fetch(`/api/channel-summary?start_date=${prevYear.startDate}&end_date=${prevYear.endDate}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/tags?start_date=${prevYear.startDate}&end_date=${prevYear.endDate}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/staff?start_date=${prevYear.startDate}&end_date=${prevYear.endDate}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/response-time?start_date=${prevYear.startDate}&end_date=${prevYear.endDate}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/volume?start_date=${prevYear.startDate}&end_date=${prevYear.endDate}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
              ]);
              
              if (!prevYearChannelRes.ok || !prevYearTagsRes.ok || !prevYearStaffRes.ok || 
                  !prevYearResponseTimeRes.ok || !prevYearVolumeRes.ok) {
                throw new Error('Failed to fetch comparison data');
              }
              
              // Process previous year data
              const prevYearChannelData = await prevYearChannelRes.json();
              const prevYearTagsData = await prevYearTagsRes.json();
              const prevYearStaffData = await prevYearStaffRes.json();
              const prevYearResponseTimeData = await prevYearResponseTimeRes.json();
              const prevYearVolumeData = await prevYearVolumeRes.json();
              
              setPrevYearData({
                channelSummary: prevYearChannelData,
                tags: prevYearTagsData,
                staff: prevYearStaffData,
                responseTime: prevYearResponseTimeData,
                volume: prevYearVolumeData
              });
              
              // Process previous year chatbot and AI metrics
              processPreviousYearChatbotAndAiMetrics(prevYearTagsData, prevYearStaffData);
            } catch (compError) {
              console.error('Error fetching comparison data:', compError);
              // We don't show error for comparison data, just reset it
              setPrevYearData({
                channelSummary: null,
                tags: null,
                staff: null,
                responseTime: null,
                volume: null
              });
            }
          }
          
          setMemoizedTagsData([]);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
          setError('Failed to load dashboard data. Please check your connection and try again.');
        } finally {
          setLoading(false);
        }
      }, 300);
      
      setFetchTimeout(timeoutId);
    };
  
    fetchDashboardData();
  }, [dateRange, token, comparisonMode]);

  // New function to process chatbot and AI metrics from the current data
  const processChatbotAndAiMetrics = (tagsData, staffData) => {
    if (!tagsData || !tagsData.tags || !staffData || !staffData.report) {
      return;
    }
    
    // Process chatbot metrics
    let totalChatbotInteractions = 0;
    let chatbotResolved = 0;
    
    // Count tags with 'chatbot' (case insensitive)
    Object.entries(tagsData.tags).forEach(([tag, count]) => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('chatbot')) {
        totalChatbotInteractions += count;
        
        // If tag also contains 'resolved' or 'solved', count as resolved
        if (tagLower.includes('resolved') || tagLower.includes('solved')) {
          chatbotResolved += count;
        }
      }
    });
    
    // Calculate chatbot resolution rate
    const chatbotResolutionRate = totalChatbotInteractions > 0 
      ? Math.round((chatbotResolved / totalChatbotInteractions) * 100) 
      : 0;
    
    setChatbotMetrics(prevMetrics => ({
      ...prevMetrics,
      totalChatbotInteractions,
      chatbotResolved,
      chatbotResolutionRate
    }));
    
    // Process AI metrics
    const totalResolved = Object.values(staffData.report)
      .reduce((sum, staff) => sum + (staff.response_count || 0), 0);
    
    // Count responses by "Silly AI"
    const aiResolved = staffData.report["Silly AI ✨"] 
      ? (staffData.report["Silly AI ✨"].response_count || 0) 
      : 0;
    
    // Calculate AI resolution rate
    const aiResolutionRate = totalResolved > 0 
      ? Math.round((aiResolved / totalResolved) * 100) 
      : 0;
    
    setAiMetrics(prevMetrics => ({
      ...prevMetrics,
      totalResolved,
      aiResolved,
      aiResolutionRate
    }));
  };
  
  // Process previous year's chatbot and AI metrics
  const processPreviousYearChatbotAndAiMetrics = (prevYearTagsData, prevYearStaffData) => {
    if (!prevYearTagsData || !prevYearTagsData.tags || !prevYearStaffData || !prevYearStaffData.report) {
      return;
    }
    
    // Process previous year chatbot metrics
    let prevYearTotalChatbotInteractions = 0;
    let prevYearChatbotResolved = 0;
    
    Object.entries(prevYearTagsData.tags).forEach(([tag, count]) => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('chatbot')) {
        prevYearTotalChatbotInteractions += count;
        
        if (tagLower.includes('resolved') || tagLower.includes('solved')) {
          prevYearChatbotResolved += count;
        }
      }
    });
    
    const prevYearChatbotResolutionRate = prevYearTotalChatbotInteractions > 0 
      ? Math.round((prevYearChatbotResolved / prevYearTotalChatbotInteractions) * 100) 
      : 0;
    
    setChatbotMetrics(prevMetrics => ({
      ...prevMetrics,
      previousYearResolutionRate: prevYearChatbotResolutionRate
    }));
    
    // Process previous year AI metrics
    const prevYearTotalResolved = Object.values(prevYearStaffData.report)
      .reduce((sum, staff) => sum + (staff.response_count || 0), 0);
    
    const prevYearAiResolved = prevYearStaffData.report["Silly AI"] 
      ? (prevYearStaffData.report["Silly AI"].response_count || 0) 
      : 0;
    
    const prevYearAiResolutionRate = prevYearTotalResolved > 0 
      ? Math.round((prevYearAiResolved / prevYearTotalResolved) * 100) 
      : 0;
    
    setAiMetrics(prevMetrics => ({
      ...prevMetrics,
      previousYearAiResolutionRate: prevYearAiResolutionRate
    }));
  };

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

  // Process data for charts - Using enhanced data processing methods
  const processVolumeData = () => {
    if (!dashboardData.volume || !dashboardData.volume.conversation_counts) return [];
    
    return Object.entries(dashboardData.volume.conversation_counts)
      .map(([date, count]) => ({
        date,
        count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Enhanced volume data processing to include year-over-year data
  const processVolumeDataWithComparison = () => {
    const currentData = processVolumeData();
    
    if (!comparisonMode || !prevYearData.volume || !prevYearData.volume.conversation_counts) {
      return currentData;
    }
    
    // Process previous year data
    const prevDataMap = new Map();
    Object.entries(prevYearData.volume.conversation_counts)
      .forEach(([date, count]) => {
        prevDataMap.set(date, count);
      });
    
    // Create a sequence of dates for proper alignment
    const dateSequence = generateDateSequence(currentData);
    
    // Map previous data to the corresponding position in the current period
    const result = currentData.map((item, index) => {
      const prevDate = dateSequence[index] ? dateSequence[index] : null;
      const prevCount = prevDate && prevDataMap.has(prevDate) ? prevDataMap.get(prevDate) : 0;
      
      return {
        ...item,
        prevCount
      };
    });
    
    return result;
  };

  // Helper to generate a sequence of dates for the previous year that aligns with current period
  const generateDateSequence = (currentData) => {
    if (!prevYearData.volume || !prevYearData.volume.conversation_counts) {
      return [];
    }
    
    // Get all dates from previous year, sorted
    const prevDates = Object.keys(prevYearData.volume.conversation_counts).sort();
    
    // If we have equal number of dates, just return the sorted previous dates
    if (prevDates.length === currentData.length) {
      return prevDates;
    }
    
    // For unequal lengths, we need more sophisticated alignment
    // For simplicity, we'll just return the available dates and pad with nulls
    return prevDates.slice(0, currentData.length);
  };

  const processResponseTimeData = () => {
    if (!dashboardData.responseTime || !dashboardData.responseTime.response_times) return [];
    
    return Object.entries(dashboardData.responseTime.response_times)
      .map(([date, seconds]) => ({
        date,
        hours: (seconds / 3600).toFixed(2) // Convert seconds to hours with 2 decimal places
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Enhanced response time data processing to include year-over-year data
  const processResponseTimeDataWithComparison = () => {
    const currentData = processResponseTimeData();
    
    if (!comparisonMode || !prevYearData.responseTime || !prevYearData.responseTime.response_times) {
      return currentData;
    }
    
    // Process previous year data
    const prevDataMap = new Map();
    Object.entries(prevYearData.responseTime.response_times)
      .forEach(([date, seconds]) => {
        prevDataMap.set(date, (seconds / 3600).toFixed(2)); // Convert to hours
      });
    
    // Create a sequence of dates for proper alignment
    const dateSequence = generateResponseTimeDateSequence(currentData);
    
    // Map previous data to the corresponding position in the current period
    const result = currentData.map((item, index) => {
      const prevDate = dateSequence[index] ? dateSequence[index] : null;
      const prevHours = prevDate && prevDataMap.has(prevDate) ? prevDataMap.get(prevDate) : null;
      
      return {
        ...item,
        prevHours
      };
    });
    
    return result;
  };

  // Helper to generate a sequence of dates for response time data
  const generateResponseTimeDateSequence = (currentData) => {
    if (!prevYearData.responseTime || !prevYearData.responseTime.response_times) {
      return [];
    }
    
    // Get all dates from previous year, sorted
    const prevDates = Object.keys(prevYearData.responseTime.response_times).sort();
    
    // If we have equal number of dates, just return the sorted previous dates
    if (prevDates.length === currentData.length) {
      return prevDates;
    }
    
    // For unequal lengths, we need more sophisticated alignment
    // For simplicity, we'll just return the available dates and pad with nulls
    return prevDates.slice(0, currentData.length);
  };
  
  // Optimized processTagsData function with memoization
  const processTagsData = () => {
    // Return memoized data if it exists and tags haven't changed
    if (memoizedTagsData.length > 0 && 
        dashboardData.tags && 
        dashboardData.tags._cachedKey === dateRange) {
      return memoizedTagsData;
    }
    
    if (!dashboardData.tags || !dashboardData.tags.tags) return [];
    
    const excludedTags = [
      'Auto Reply', '💎 VIP', 'Pre-order', 'Order Edited', 'No AI', 
      'AI Error', 'Other', 'Auto Resolved', 'Out of Office', 'Spam',
      'Returns - ParcelFeeder', 'Returns - ColliFlow', '✨ Auto Reply', 'Out Of Office'
    ];
    
    // Create a case-insensitive exclusion check but keep Chatbot and Chatbot Resolved
    const isExcluded = (tagName) => {
      // Keep chatbot tags for analysis
      if (tagName.toLowerCase().includes('chatbot')) return false;
      
      // Check exact match first
      if (excludedTags.includes(tagName)) return true;
      
      // Then check case-insensitive match
      return excludedTags.some(excluded => 
        tagName.toLowerCase() === excluded.toLowerCase() ||
        tagName.toLowerCase().includes('auto') ||
        tagName.toLowerCase().includes('office')
      );
    };
    
    const processed = Object.entries(dashboardData.tags.tags)
      .filter(([name]) => !isExcluded(name))
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Store the processed data with a cache key
    if (dashboardData.tags) {
      dashboardData.tags._cachedKey = dateRange;
      setMemoizedTagsData(processed);
    }
    
    return processed;
  };

  // Process tags data with comparison to the previous year
  const processTagsDataWithComparison = () => {
    const currentTags = processTagsData();
    
    if (!comparisonMode || !prevYearData.tags || !prevYearData.tags.tags) {
      return currentTags;
    }
    
    // Create a map of previous year tags for easy lookup
    const prevTagsMap = new Map();
    Object.entries(prevYearData.tags.tags)
      .forEach(([name, count]) => {
        prevTagsMap.set(name, count);
      });
    
    // Add comparison data to current tags
    return currentTags.map(tag => {
      const prevValue = prevTagsMap.has(tag.name) ? prevTagsMap.get(tag.name) : 0;
      const change = prevValue > 0 ? ((tag.value - prevValue) / prevValue) * 100 : null;
      
      return {
        ...tag,
        prevValue,
        change: change !== null ? Math.round(change) : null,
        increased: change > 0
      };
    });
  };

  const processStaffData = () => {
    if (!dashboardData.staff || !dashboardData.staff.report) return [];
    
    return Object.entries(dashboardData.staff.report)
      .map(([name, data]) => ({
        name,
        responseCount: data.response_count || 0,
        appreciations: data.appreciations_count || 0,
        responseTime: data.response_time_seconds ? Math.round(data.response_time_seconds / 60) : 0,
        isAi: name === "Silly AI" // Flag for AI staff
      }))
      .sort((a, b) => b.responseCount - a.responseCount)
      .slice(0, 5);
  };

  // Process staff data with comparison to previous year
  const processStaffDataWithComparison = () => {
    const currentStaff = processStaffData();
    
    if (!comparisonMode || !prevYearData.staff || !prevYearData.staff.report) {
      return currentStaff;
    }
    
    // Create a map of previous year staff data for easy lookup
    const prevStaffMap = new Map();
    Object.entries(prevYearData.staff.report)
      .forEach(([name, data]) => {
        prevStaffMap.set(name, {
          responseCount: data.response_count || 0,
          appreciations: data.appreciations_count || 0,
          responseTime: data.response_time_seconds ? Math.round(data.response_time_seconds / 60) : 0
        });
      });
    
    // Add comparison data to current staff
    return currentStaff.map(staff => {
      const prevData = prevStaffMap.has(staff.name) ? prevStaffMap.get(staff.name) : null;
      
      return {
        ...staff,
        prevResponseCount: prevData ? prevData.responseCount : 0,
        prevAppreciations: prevData ? prevData.appreciations : 0,
        prevResponseTime: prevData ? prevData.responseTime : 0,
        responseCountChange: prevData && prevData.responseCount > 0 
          ? Math.round(((staff.responseCount - prevData.responseCount) / prevData.responseCount) * 100) 
          : null,
        responseTimeImproved: prevData ? staff.responseTime < prevData.responseTime : false
      };
    });
  };

  const processChannelData = () => {
    if (!dashboardData.channelSummary || !dashboardData.channelSummary.channels) return [];
    
    const channels = dashboardData.channelSummary.channels;
    const channelTypes = {};
    
    // Group by channel type
    Object.entries(channels).forEach(([id, channelData]) => {
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

  // Helper functions for metrics with comparison support
  const getAverageResponseTime = () => {
    if (!dashboardData.responseTime || 
        !dashboardData.responseTime.summary || 
        !dashboardData.responseTime.summary.averages) {
      return { current: 'N/A', change: null };
    }
    
    const avgSeconds = dashboardData.responseTime.summary.averages.in_range;
    let formattedTime;
    
    if (avgSeconds < 60) formattedTime = `${avgSeconds} sec`;
    else if (avgSeconds < 3600) formattedTime = `${Math.round(avgSeconds / 60)} min`;
    else formattedTime = `${(avgSeconds / 3600).toFixed(2)} hr`;
    
    if (!comparisonMode || 
        !prevYearData.responseTime || 
        !prevYearData.responseTime.summary || 
        !prevYearData.responseTime.summary.averages) {
      return { current: formattedTime, change: null };
    }
    
    const prevAvgSeconds = prevYearData.responseTime.summary.averages.in_range;
    
    return {
      current: formattedTime,
      change: calculateResponseTimeChange(avgSeconds, prevAvgSeconds)
    };
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
      return { current: 'N/A', change: null };
    }
    
    const currentTotal = Object.values(dashboardData.volume.conversation_counts)
      .reduce((sum, count) => sum + count, 0);
    
    if (!comparisonMode || !prevYearData.volume || !prevYearData.volume.conversation_counts) {
      return { current: currentTotal, change: null };
    }
    
    const prevTotal = Object.values(prevYearData.volume.conversation_counts)
      .reduce((sum, count) => sum + count, 0);
    
    return { 
      current: currentTotal, 
      change: calculatePercentChange(currentTotal, prevTotal)
    };
  };

  const getAverageSatisfaction = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === undefined ||
        dashboardData.channelSummary.aggregated.average_satisfaction_rating === null) {
      return { current: null, change: null };
    }
    
    const currentSatisfaction = dashboardData.channelSummary.aggregated.average_satisfaction_rating;
    
    if (!comparisonMode || 
        !prevYearData.channelSummary || 
        !prevYearData.channelSummary.aggregated || 
        prevYearData.channelSummary.aggregated.average_satisfaction_rating === undefined ||
        prevYearData.channelSummary.aggregated.average_satisfaction_rating === null) {
      return { current: currentSatisfaction.toFixed(1), change: null };
    }
    
    const prevSatisfaction = prevYearData.channelSummary.aggregated.average_satisfaction_rating;
    
    return {
      current: currentSatisfaction.toFixed(1),
      change: calculatePercentChange(currentSatisfaction, prevSatisfaction, true) // CSAT higher is better
    };
  };

  const getActiveTickets = () => {
    if (!dashboardData.channelSummary || 
        !dashboardData.channelSummary.aggregated || 
        dashboardData.channelSummary.aggregated.active_conversations === undefined) {
      return { current: 'N/A', change: null };
    }
    
    const currentActive = dashboardData.channelSummary.aggregated.active_conversations;
    
    if (!comparisonMode || 
        !prevYearData.channelSummary || 
        !prevYearData.channelSummary.aggregated || 
        prevYearData.channelSummary.aggregated.active_conversations === undefined) {
      return { current: currentActive, change: null };
    }
    
    const prevActive = prevYearData.channelSummary.aggregated.active_conversations;
    
    return {
      current: currentActive,
      change: calculatePercentChange(currentActive, prevActive, false) // Active tickets lower is better
    };
  };

  const calculatePercentChange = (current, previous, higherIsBetter = true) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      isPositive: change > 0,
      isImprovement: higherIsBetter ? change > 0 : change < 0
    };
  };
  
  // For response time specifically (where lower is better)
  const calculateResponseTimeChange = (current, previous) => {
    if (!current || !previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      isPositive: change > 0,
      isImprovement: change < 0 // For response time, lower is better
    };
  };
  
  // Generate dashboard summary based on real data
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
        
        {getActiveTickets().current !== 'N/A' && (
          <>
            Currently <span className="font-bold text-yellow-300">{getActiveTickets().current}</span> active tickets 
            require attention.
          </>
        )}
        
        {chatbotMetrics.chatbotResolutionRate > 0 && (
          <>
            {' '}Chatbot has <span className="font-bold text-yellow-300">automatically resolved {chatbotMetrics.chatbotResolutionRate}%</span> of its interactions.
          </>
        )}
        
        {aiMetrics.aiResolutionRate > 0 && (
          <>
            {' '}<span className="font-bold text-yellow-300">Silly AI</span> has handled <span className="font-bold text-yellow-300">{aiMetrics.aiResolutionRate}%</span> of all tickets.
          </>
        )}
      </span>
    );
  };

  // Helper function to format percentage change for display
  const formatPercentChange = (change) => {
    if (!change) return null;
    return `${change.isPositive ? '+' : '-'}${change.value}%`;
  };

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Custom functions for enhanced pie chart
  const onPieEnter = (_, index) => {
    setActiveTagIndex(index);
  };
  
  const onPieLeave = () => {
    setActiveTagIndex(null);
  };

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 5}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  // Format the date range label for display
  const getDateRangeLabel = () => {
    switch (dateRange) {
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case 'month':
        return 'This month';
      case 'quarter':
        return 'This quarter';
      case 'ytd':
        return 'Year to date';
      default:
        return 'Selected period';
    }
  };

  // Format the comparison label for year-over-year
  const getComparisonLabel = () => {
    return `vs Same Period Last Year`;
  };

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
              <option value="quarter">This quarter</option>
              <option value="ytd">Year to date</option>
            </select>
            <label className="flex items-center text-sm">
              <input 
                type="checkbox" 
                checked={comparisonMode}
                onChange={() => setComparisonMode(!comparisonMode)}
                className="mr-1"
              />
              Year-over-Year
            </label>
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
        
        {/* Summary Box */}
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
      
      {/* KPI Summary - first row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Response Time KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <Clock className="text-blue-500 mr-2" size={20} />
            <h3 className="font-semibold">Avg. Response Time</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getAverageResponseTime().current}</p>
          {comparisonMode && getAverageResponseTime().change && (
            <p className={`text-sm ${getAverageResponseTime().change.isImprovement ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {getAverageResponseTime().change.isImprovement ? '↓' : '↑'} 
              {getAverageResponseTime().change.value}% {getComparisonLabel()}
            </p>
          )}
        </div>
        
        {/* Total Tickets KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <Inbox className="text-purple-500 mr-2" size={20} />
            <h3 className="font-semibold">Total Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getTotalTickets().current}</p>
          {comparisonMode && getTotalTickets().change && (
            <p className={`text-sm ${getTotalTickets().change.isImprovement ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {getTotalTickets().change.isPositive ? '↑' : '↓'} 
              {getTotalTickets().change.value}% {getComparisonLabel()}
            </p>
          )}
        </div>
        
        {/* CSAT Score KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <ThumbsUp className="text-green-500 mr-2" size={20} />
            <h3 className="font-semibold">CSAT Score</h3>
          </div>
          {getAverageSatisfaction().current !== null ? (
            <p className="text-3xl font-bold mt-2">{getAverageSatisfaction().current}/5.0</p>
          ) : (
            <p className="text-3xl font-bold mt-2">No Data</p>
          )}
          {comparisonMode && getAverageSatisfaction().change && (
            <p className={`text-sm ${getAverageSatisfaction().change.isImprovement ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {getAverageSatisfaction().change.isPositive ? '↑' : '↓'} 
              {getAverageSatisfaction().change.value}% {getComparisonLabel()}
            </p>
          )}
        </div>
        
        {/* Open Tickets KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center">
            <AlertTriangle className="text-yellow-500 mr-2" size={20} />
            <h3 className="font-semibold">Open Tickets</h3>
          </div>
          <p className="text-3xl font-bold mt-2">{getActiveTickets().current}</p>
          {comparisonMode && getActiveTickets().change && (
            <p className={`text-sm ${getActiveTickets().change.isImprovement ? 'text-green-500' : 'text-red-500'} flex items-center`}>
              {getActiveTickets().change.isPositive ? '↑' : '↓'} 
              {getActiveTickets().change.value}% {getComparisonLabel()}
            </p>
          )}
        </div>
      </div>
      
      {/* NEW: Chatbot & AI KPIs - second row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Chatbot Resolution KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center mb-3">
            <Bot className="text-blue-500 mr-2" size={20} />
            <h3 className="font-semibold">Chatbot Performance</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Interactions</p>
              <p className="text-xl font-bold">{chatbotMetrics.totalChatbotInteractions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Auto-Resolved</p>
              <p className="text-xl font-bold">{chatbotMetrics.chatbotResolved}</p>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <p className="text-sm text-gray-500">Resolution Rate</p>
              <p className="text-sm font-semibold">{chatbotMetrics.chatbotResolutionRate}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-500 h-2.5 rounded-full" 
                style={{ width: `${chatbotMetrics.chatbotResolutionRate}%` }}
              ></div>
            </div>
            
            {comparisonMode && chatbotMetrics.previousYearResolutionRate > 0 && (
              <p className={`text-xs mt-1 ${chatbotMetrics.chatbotResolutionRate > chatbotMetrics.previousYearResolutionRate ? 'text-green-500' : 'text-red-500'}`}>
                {chatbotMetrics.chatbotResolutionRate > chatbotMetrics.previousYearResolutionRate ? '↑' : '↓'} 
                {Math.abs(chatbotMetrics.chatbotResolutionRate - chatbotMetrics.previousYearResolutionRate)}% vs last year ({chatbotMetrics.previousYearResolutionRate}%)
              </p>
            )}
          </div>
        </div>
        
        {/* AI Resolution KPI */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center mb-3">
            <Award className="text-purple-500 mr-2" size={20} />
            <h3 className="font-semibold">AI Resolution Rate (Silly AI)</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Resolved</p>
              <p className="text-xl font-bold">{aiMetrics.totalResolved}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">AI Resolved</p>
              <p className="text-xl font-bold">{aiMetrics.aiResolved}</p>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <p className="text-sm text-gray-500">AI Resolution Rate</p>
              <p className="text-sm font-semibold">{aiMetrics.aiResolutionRate}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-purple-500 h-2.5 rounded-full" 
                style={{ width: `${aiMetrics.aiResolutionRate}%` }}
              ></div>
            </div>
            
            {comparisonMode && aiMetrics.previousYearAiResolutionRate > 0 && (
              <p className={`text-xs mt-1 ${aiMetrics.aiResolutionRate > aiMetrics.previousYearAiResolutionRate ? 'text-green-500' : 'text-red-500'}`}>
                {aiMetrics.aiResolutionRate > aiMetrics.previousYearAiResolutionRate ? '↑' : '↓'} 
                {Math.abs(aiMetrics.aiResolutionRate - aiMetrics.previousYearAiResolutionRate)}% vs last year ({aiMetrics.previousYearAiResolutionRate}%)
              </p>
            )}
          </div>
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
            {comparisonMode && (
              <div className="ml-auto flex items-center text-sm">
                <div className="flex items-center mr-4">
                  <div className="w-3 h-3 bg-blue-500 mr-1"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 mr-1"></div>
                  <span>Last Year</span>
                </div>
              </div>
            )}
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">{getAverageResponseTime().current}</p>
                <p className="text-sm text-gray-500">Average ({getDateRangeLabel()})</p>
              </div>
              {getResponseTimeChange() && (
                <div className="text-right">
                  <p className={getResponseTimeChange().isImprovement ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                    {getResponseTimeChange().isImprovement ? '↓' : '↑'} {getResponseTimeChange().value}
                  </p>
                  <p className="text-sm text-gray-500">{getComparisonLabel()}</p>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart 
              data={comparisonMode ? processResponseTimeDataWithComparison() : processResponseTimeData()} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis 
                domain={[0, 'dataMax + 5']} // Dynamically set max with padding
                allowDataOverflow={false}
              />
              <Tooltip 
                formatter={(value, name) => {
                  return [
                    `${value} hr`, 
                    name === "hours" ? "Current Period" : "Last Year"
                  ];
                }} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="#0088FE" 
                name="Current Period" 
                strokeWidth={2} 
              />
              {comparisonMode && (
                <Line 
                  type="monotone" 
                  dataKey="prevHours" 
                  stroke="#82ca9d" 
                  name="Last Year" 
                  strokeWidth={2} 
                  strokeDasharray="3 3"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Number of Tickets Section */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center mb-4">
            <Inbox className="text-purple-500 mr-2" size={20} />
            <h2 className="text-xl font-bold">Number of Tickets</h2>
            {comparisonMode && (
              <div className="ml-auto flex items-center text-sm">
                <div className="flex items-center mr-4">
                  <div className="w-3 h-3 bg-purple-500 mr-1"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 mr-1"></div>
                  <span>Last Year</span>
                </div>
              </div>
            )}
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">{getTotalTickets().current}</p>
                <p className="text-sm text-gray-500">Total ({getDateRangeLabel()})</p>
              </div>
              {comparisonMode && getTotalTickets().change && (
                <div className="text-right">
                  <p className={getTotalTickets().change.isImprovement ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                    {getTotalTickets().change.isPositive ? '↑' : '↓'} {getTotalTickets().change.value}%
                  </p>
                  <p className="text-sm text-gray-500">{getComparisonLabel()}</p>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={comparisonMode ? processVolumeDataWithComparison() : processVolumeData()} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Current Period" />
              {comparisonMode && (
                <Bar dataKey="prevCount" fill="#82ca9d" name="Last Year" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Staff Performance Section */}
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
              
              {(comparisonMode ? processStaffDataWithComparison() : processStaffData()).map((staff, index) => (
                <div key={index} className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className={`font-semibold ${staff.isAi ? 'text-purple-500 flex items-center' : ''}`}>
                      {staff.isAi && <Bot size={16} className="mr-1" />}
                      {staff.name}
                    </span>
                    <div className="flex space-x-4">
                      <span className="w-20 text-right">
                        {staff.responseCount}
                        {comparisonMode && staff.responseCountChange !== null && (
                          <span className={staff.responseCountChange > 0 ? "text-green-500 ml-1" : "text-red-500 ml-1"}>
                            {staff.responseCountChange > 0 ? '↑' : '↓'}
                          </span>
                        )}
                      </span>
                      <span className="w-20 text-right">{staff.appreciations}</span>
                      <span className="w-20 text-right">
                        {staff.responseTime} min
                        {comparisonMode && staff.prevResponseTime > 0 && (
                          <span className={staff.responseTimeImproved ? "text-green-500 ml-1" : "text-red-500 ml-1"}>
                            {staff.responseTimeImproved ? '↓' : '↑'}
                          </span>
                        )}
                      </span>
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
              {processTagsData().length > 0 ? (
                <div className="h-52"> {/* Fixed height container */}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Pie
                        data={processTagsData()}
                        cx="50%"
                        cy="45%" 
                        labelLine={false} 
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        activeIndex={activeTagIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={onPieEnter}
                        onMouseLeave={onPieLeave}
                        label={({ name, percent }) => {
                          // Only show label for larger segments
                          if (percent < 0.1) return null;
                          
                          // Extremely shortened label for pie segments
                          return percent > 0.15 ? `${(percent * 100).toFixed(0)}%` : '';
                        }}
                      >
                        {processTagsData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => {
                          // Format the tooltip better
                          return [`${value} tickets`, name];
                        }}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }}
                        formatter={(value) => {
                          // Shorten legend labels
                          return value.length > 15 ? `${value.substring(0, 15)}...` : value;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  No tag data available
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Users size={16} className="mr-1 text-purple-500" /> Top Tags by Volume
              </h3>
              {processTagsData().length > 0 ? (
                (comparisonMode ? processTagsDataWithComparison() : processTagsData()).map((tag, index) => (
                  <div key={index} className="flex items-center justify-between mb-2">
                    <div className="text-sm truncate pr-2">
                      {tag.name}
                      {comparisonMode && tag.change !== null && (
                        <span className={tag.increased ? "text-green-500 ml-1" : "text-red-500 ml-1"}>
                          {tag.increased ? '↑' : '↓'}{Math.abs(tag.change)}%
                        </span>
                      )}
                    </div>
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
      
      {/* NEW: Chatbot Activity Analysis */}
      <div className="mt-6 bg-white p-6 rounded shadow">
        <div className="flex items-center mb-4">
          <Bot className="text-blue-500 mr-2" size={20} />
          <h2 className="text-xl font-bold">Chatbot & AI Performance Analysis</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chatbot resolution metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Bot size={16} className="mr-1 text-blue-500" /> Chatbot Resolution Statistics
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Total Interactions</p>
                  <p className="text-2xl font-bold">{chatbotMetrics.totalChatbotInteractions}</p>
                  {comparisonMode && prevYearData.tags && (
                    <p className="text-xs text-gray-500 mt-1">vs last year</p>
                  )}
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Successfully Resolved</p>
                  <p className="text-2xl font-bold">{chatbotMetrics.chatbotResolved}</p>
                  {comparisonMode && prevYearData.tags && (
                    <p className="text-xs text-gray-500 mt-1">vs last year</p>
                  )}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium">Resolution Rate</p>
                  <p className="text-sm font-bold">{chatbotMetrics.chatbotResolutionRate}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full" 
                    style={{ width: `${chatbotMetrics.chatbotResolutionRate}%` }}
                  ></div>
                </div>
                
                {comparisonMode && chatbotMetrics.previousYearResolutionRate > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm text-gray-500">Last Year Rate</p>
                      <p className="text-sm">{chatbotMetrics.previousYearResolutionRate}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-300 h-2 rounded-full" 
                        style={{ width: `${chatbotMetrics.previousYearResolutionRate}%` }}
                      ></div>
                    </div>
                    
                    <p className={`text-xs mt-1 ${chatbotMetrics.chatbotResolutionRate > chatbotMetrics.previousYearResolutionRate ? 'text-green-500' : 'text-red-500'} font-medium`}>
                      {chatbotMetrics.chatbotResolutionRate > chatbotMetrics.previousYearResolutionRate 
                        ? `↑ Improved by ${chatbotMetrics.chatbotResolutionRate - chatbotMetrics.previousYearResolutionRate}%` 
                        : `↓ Decreased by ${chatbotMetrics.previousYearResolutionRate - chatbotMetrics.chatbotResolutionRate}%`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* AI Resolution metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Award size={16} className="mr-1 text-purple-500" /> AI Assistance (Silly AI)
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 p-3 rounded">
                  <p className="text-sm text-gray-500">AI-Handled Tickets</p>
                  <p className="text-2xl font-bold">{aiMetrics.aiResolved}</p>
                  {comparisonMode && prevYearData.staff && (
                    <p className="text-xs text-gray-500 mt-1">vs last year</p>
                  )}
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Total Responses</p>
                  <p className="text-2xl font-bold">{aiMetrics.totalResolved}</p>
                  {comparisonMode && prevYearData.staff && (
                    <p className="text-xs text-gray-500 mt-1">vs last year</p>
                  )}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium">AI Resolution Rate</p>
                  <p className="text-sm font-bold">{aiMetrics.aiResolutionRate}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-purple-500 h-3 rounded-full" 
                    style={{ width: `${aiMetrics.aiResolutionRate}%` }}
                  ></div>
                </div>
                
                {comparisonMode && aiMetrics.previousYearAiResolutionRate > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm text-gray-500">Last Year Rate</p>
                      <p className="text-sm">{aiMetrics.previousYearAiResolutionRate}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-300 h-2 rounded-full" 
                        style={{ width: `${aiMetrics.previousYearAiResolutionRate}%` }}
                      ></div>
                    </div>
                    
                    <p className={`text-xs mt-1 ${aiMetrics.aiResolutionRate > aiMetrics.previousYearAiResolutionRate ? 'text-green-500' : 'text-red-500'} font-medium`}>
                      {aiMetrics.aiResolutionRate > aiMetrics.previousYearAiResolutionRate 
                        ? `↑ Improved by ${aiMetrics.aiResolutionRate - aiMetrics.previousYearAiResolutionRate}%` 
                        : `↓ Decreased by ${aiMetrics.previousYearAiResolutionRate - aiMetrics.aiResolutionRate}%`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Show configured brands at bottom if we have some */}
      {brands.length > 0 && <div className="mt-8"><BrandsSection /></div>}
    </div>
  );
};

export default Dashboard;