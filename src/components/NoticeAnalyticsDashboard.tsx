import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Badge, Table, ProgressBar } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Eye, 
  Clock, 
  Users, 
  MousePointer, 
  Smartphone, 
  Monitor, 
  Tablet,
  TrendingUp,
  Activity
} from 'lucide-react';
import noticeService from '../services/noticeService';

interface NoticeAnalyticsDashboardProps {
  noticeId?: number; // If provided, shows single notice analytics
  dateFrom?: string;
  dateTo?: string;
}

interface NoticeAnalytics {
  totalViews: number;
  uniqueViewers: number;
  averageViewDuration: number;
  completionRate: number;
  averageScrollPercentage: number;
  totalInteractions: number;
  deviceBreakdown: { [key: string]: number };
  referrerBreakdown: { [key: string]: number };
  viewTrends: Array<{ date: string; views: number; }>;
}

interface CompanyAnalytics {
  totalNotices: number;
  totalViews: number;
  averageEngagement: number;
  topNotices: Array<{
    noticeId: number;
    title: string;
    views: number;
    completionRate: number;
  }>;
  engagementTrends: Array<{ date: string; views: number; completions: number; }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const NoticeAnalyticsDashboard: React.FC<NoticeAnalyticsDashboardProps> = ({
  noticeId,
  dateFrom,
  dateTo
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [noticeAnalytics, setNoticeAnalytics] = useState<NoticeAnalytics | null>(null);
  const [companyAnalytics, setCompanyAnalytics] = useState<CompanyAnalytics | null>(null);

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [noticeId, dateFrom, dateTo]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      if (noticeId) {
        // Load single notice analytics
        const data = await noticeService.getNoticeAnalytics(noticeId);
        setNoticeAnalytics(data);
      } else {
        // Load company-wide analytics
        const data = await noticeService.getCompanyNoticeAnalytics(dateFrom, dateTo);
        setCompanyAnalytics(data);
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load analytics');
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone size={16} />;
      case 'tablet': return <Tablet size={16} />;
      default: return <Monitor size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading analytics...</span>
        </div>
        <p className="mt-2 text-muted">Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <h6>Analytics Error</h6>
        <p className="mb-0">{error}</p>
      </div>
    );
  }

  // Render single notice analytics
  if (noticeId && noticeAnalytics) {
    const deviceData = Object.entries(noticeAnalytics.deviceBreakdown).map(([device, count]) => ({
      name: device,
      value: count,
      percentage: (count / noticeAnalytics.totalViews * 100).toFixed(1)
    }));

    const referrerData = Object.entries(noticeAnalytics.referrerBreakdown).map(([referrer, count]) => ({
      name: referrer.replace('_', ' '),
      value: count
    }));

    return (
      <div className="notice-analytics-dashboard">
        {/* Key Metrics Cards */}
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Eye size={24} className="text-primary me-2" />
                  <h4 className="mb-0">{noticeAnalytics.totalViews}</h4>
                </div>
                <small className="text-muted">Total Views</small>
                <div className="mt-1">
                  <Badge bg="info">{noticeAnalytics.uniqueViewers} unique</Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Clock size={24} className="text-success me-2" />
                  <h4 className="mb-0">{formatDuration(noticeAnalytics.averageViewDuration)}</h4>
                </div>
                <small className="text-muted">Avg View Time</small>
                <div className="mt-1">
                  <ProgressBar
                    variant="success"
                    now={Math.min(noticeAnalytics.averageViewDuration / 300 * 100, 100)}
                    style={{ height: '4px' }}
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <TrendingUp size={24} className="text-warning me-2" />
                  <h4 className="mb-0">{formatPercentage(noticeAnalytics.completionRate)}</h4>
                </div>
                <small className="text-muted">Completion Rate</small>
                <div className="mt-1">
                  <ProgressBar
                    variant="warning"
                    now={noticeAnalytics.completionRate}
                    style={{ height: '4px' }}
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={3}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <MousePointer size={24} className="text-info me-2" />
                  <h4 className="mb-0">{noticeAnalytics.totalInteractions}</h4>
                </div>
                <small className="text-muted">Total Interactions</small>
                <div className="mt-1">
                  <Badge bg="secondary">
                    {(noticeAnalytics.totalInteractions / Math.max(noticeAnalytics.totalViews, 1)).toFixed(1)} per view
                  </Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Charts Row */}
        <Row className="mb-4">
          {/* Device Breakdown */}
          <Col md={6}>
            <Card className="h-100">
              <Card.Header>
                <h6 className="mb-0">Device Breakdown</h6>
              </Card.Header>
              <Card.Body>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>

          {/* Referrer Sources */}
          <Col md={6}>
            <Card className="h-100">
              <Card.Header>
                <h6 className="mb-0">Traffic Sources</h6>
              </Card.Header>
              <Card.Body>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={referrerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* View Trends */}
        {noticeAnalytics.viewTrends.length > 0 && (
          <Card>
            <Card.Header>
              <h6 className="mb-0">View Trends</h6>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={noticeAnalytics.viewTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#0088FE" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        )}
      </div>
    );
  }

  // Render company-wide analytics
  if (companyAnalytics) {
    return (
      <div className="company-analytics-dashboard">
        {/* Company Overview Cards */}
        <Row className="mb-4">
          <Col md={4}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Activity size={24} className="text-primary me-2" />
                  <h4 className="mb-0">{companyAnalytics.totalNotices}</h4>
                </div>
                <small className="text-muted">Total Notices</small>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Eye size={24} className="text-success me-2" />
                  <h4 className="mb-0">{companyAnalytics.totalViews}</h4>
                </div>
                <small className="text-muted">Total Views</small>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="text-center h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <TrendingUp size={24} className="text-warning me-2" />
                  <h4 className="mb-0">{formatPercentage(companyAnalytics.averageEngagement)}</h4>
                </div>
                <small className="text-muted">Avg Engagement</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Top Performing Notices */}
        <Card className="mb-4">
          <Card.Header>
            <h6 className="mb-0">Top Performing Notices</h6>
          </Card.Header>
          <Card.Body>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Notice</th>
                  <th>Views</th>
                  <th>Completion Rate</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {companyAnalytics.topNotices.map((notice) => (
                  <tr key={notice.noticeId}>
                    <td>
                      <strong>#{notice.noticeId}</strong>
                      <br />
                      <small className="text-muted">{notice.title}</small>
                    </td>
                    <td>
                      <Badge bg="primary">{notice.views}</Badge>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <span className="me-2">{formatPercentage(notice.completionRate)}</span>
                        <ProgressBar
                          variant={notice.completionRate > 70 ? 'success' : notice.completionRate > 40 ? 'warning' : 'danger'}
                          now={notice.completionRate}
                          style={{ width: '100px', height: '6px' }}
                        />
                      </div>
                    </td>
                    <td>
                      {notice.completionRate > 70 && <Badge bg="success">Excellent</Badge>}
                      {notice.completionRate <= 70 && notice.completionRate > 40 && <Badge bg="warning">Good</Badge>}
                      {notice.completionRate <= 40 && <Badge bg="danger">Needs Improvement</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>

        {/* Engagement Trends */}
        {companyAnalytics.engagementTrends.length > 0 && (
          <Card>
            <Card.Header>
              <h6 className="mb-0">Engagement Trends</h6>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={companyAnalytics.engagementTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#0088FE" 
                    strokeWidth={2}
                    name="Views"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completions" 
                    stroke="#00C49F" 
                    strokeWidth={2}
                    name="Completions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="text-center text-muted p-4">
      <Activity size={48} className="mb-3" />
      <p>No analytics data available</p>
    </div>
  );
};

export default NoticeAnalyticsDashboard;