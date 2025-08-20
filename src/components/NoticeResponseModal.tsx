import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  Check, 
  MessageCircle, 
  AlertTriangle, 
  X, 
  Clock, 
  HelpCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NoticeResponseModalProps {
  show: boolean;
  onHide: () => void;
  noticeId: number;
  noticeTitle: string;
  onResponseSubmitted: () => void;
  existingResponse?: NoticeResponse | null;
}

export interface NoticeResponse {
  NOTICE_RESPONSE_ID: number;
  NOTICE_ID: number;
  USER_ID: number;
  RESPONSE_TYPE: string;
  RESPONSE_MESSAGE: string | null;
  RESPONSE_DATE: string;
  RESPONSE_STATUS: string;
  REQUIRES_FOLLOWUP: boolean;
  FOLLOWUP_PRIORITY: string | null;
  IS_ANONYMOUS: boolean;
}

const RESPONSE_TYPES = [
  {
    value: 'ACKNOWLEDGED',
    label: 'Acknowledged',
    description: 'I have read and understood this notice',
    icon: <Check size={16} className="text-success" />,
    color: 'success',
    requiresFollowup: false
  },
  {
    value: 'UNDERSTOOD',
    label: 'Understood',
    description: 'I understand the content and implications',
    icon: <CheckCircle2 size={16} className="text-info" />,
    color: 'info',
    requiresFollowup: false
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'I have completed the required action(s)',
    icon: <CheckCircle2 size={16} className="text-success" />,
    color: 'success',
    requiresFollowup: false
  },
  {
    value: 'PARTIALLY_COMPLETED',
    label: 'Partially Completed',
    description: 'I have started but not finished the required action(s)',
    icon: <Clock size={16} className="text-warning" />,
    color: 'warning',
    requiresFollowup: true
  },
  {
    value: 'NEEDS_EXTENSION',
    label: 'Needs Extension',
    description: 'I need more time to complete the requirements',
    icon: <Clock size={16} className="text-warning" />,
    color: 'warning',
    requiresFollowup: true
  },
  {
    value: 'REQUIRES_CLARIFICATION',
    label: 'Needs Clarification',
    description: 'I need additional information or clarification',
    icon: <HelpCircle size={16} className="text-warning" />,
    color: 'warning',
    requiresFollowup: true
  },
  {
    value: 'CANNOT_COMPLY',
    label: 'Cannot Comply',
    description: 'I am unable to comply with this notice',
    icon: <XCircle size={16} className="text-danger" />,
    color: 'danger',
    requiresFollowup: true
  }
];

const NoticeResponseModal: React.FC<NoticeResponseModalProps> = ({
  show,
  onHide,
  noticeId,
  noticeTitle,
  onResponseSubmitted,
  existingResponse
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [responseType, setResponseType] = useState<string>('ACKNOWLEDGED');
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [followupPriority, setFollowupPriority] = useState<string>('MEDIUM');

  // Initialize form with existing response data
  useEffect(() => {
    if (existingResponse) {
      setResponseType(existingResponse.RESPONSE_TYPE);
      setResponseMessage(existingResponse.RESPONSE_MESSAGE || '');
      setIsAnonymous(existingResponse.IS_ANONYMOUS);
      setFollowupPriority(existingResponse.FOLLOWUP_PRIORITY || 'MEDIUM');
    } else {
      // Reset form for new response
      setResponseType('ACKNOWLEDGED');
      setResponseMessage('');
      setIsAnonymous(false);
      setFollowupPriority('MEDIUM');
    }
    setError(null);
  }, [existingResponse, show]);

  const selectedResponseType = RESPONSE_TYPES.find(type => type.value === responseType);
  const requiresFollowup = selectedResponseType?.requiresFollowup || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const responseData = {
        responseType,
        responseMessage: responseMessage.trim() || null,
        isAnonymous,
        followupPriority: requiresFollowup ? followupPriority : null
      };

      let response;
      if (existingResponse) {
        // Update existing response
        response = await fetch(`/api/notices/${noticeId}/responses/${existingResponse.NOTICE_RESPONSE_ID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(responseData)
        });
      } else {
        // Create new response
        response = await fetch(`/api/notices/${noticeId}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(responseData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit response');
      }

      toast.success(existingResponse ? 'Response updated successfully' : 'Response submitted successfully');
      onResponseSubmitted();
      onHide();

    } catch (err: any) {
      console.error('Error submitting response:', err);
      setError(err.message || 'Failed to submit response');
      toast.error('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawResponse = async () => {
    if (!existingResponse || !user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/notices/${noticeId}/responses/${existingResponse.NOTICE_RESPONSE_ID}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to withdraw response');
      }

      toast.success('Response withdrawn successfully');
      onResponseSubmitted();
      onHide();

    } catch (err: any) {
      console.error('Error withdrawing response:', err);
      setError(err.message || 'Failed to withdraw response');
      toast.error('Failed to withdraw response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <MessageCircle size={20} className="me-2" />
          {existingResponse ? 'Update Response' : 'Respond to Notice'}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Notice Information */}
          <Alert variant="light" className="mb-4">
            <strong>Notice:</strong> {noticeTitle}
            <br />
            <small className="text-muted">ID: #{noticeId}</small>
          </Alert>

          {/* Error Display */}
          {error && (
            <Alert variant="danger" className="mb-3">
              <AlertTriangle size={16} className="me-2" />
              {error}
            </Alert>
          )}

          {/* Existing Response Info */}
          {existingResponse && (
            <Alert variant="info" className="mb-3">
              <strong>Current Response:</strong> 
              <Badge bg={RESPONSE_TYPES.find(t => t.value === existingResponse.RESPONSE_TYPE)?.color || 'secondary'} className="ms-2">
                {RESPONSE_TYPES.find(t => t.value === existingResponse.RESPONSE_TYPE)?.label}
              </Badge>
              <br />
              <small className="text-muted">
                Submitted on: {new Date(existingResponse.RESPONSE_DATE).toLocaleString()}
              </small>
            </Alert>
          )}

          {/* Response Type Selection */}
          <Form.Group className="mb-3">
            <Form.Label>Response Type <span className="text-danger">*</span></Form.Label>
            <div className="row">
              {RESPONSE_TYPES.map((type) => (
                <div key={type.value} className="col-md-6 mb-2">
                  <Form.Check
                    type="radio"
                    id={`response-${type.value}`}
                    name="responseType"
                    value={type.value}
                    checked={responseType === type.value}
                    onChange={(e) => setResponseType(e.target.value)}
                    disabled={loading}
                    label={
                      <div className="d-flex align-items-start">
                        <div className="me-2 mt-1">{type.icon}</div>
                        <div>
                          <div className="fw-medium">{type.label}</div>
                          <small className="text-muted">{type.description}</small>
                          {type.requiresFollowup && (
                            <div>
                              <Badge bg="warning" size="sm" className="mt-1">
                                Requires Follow-up
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </Form.Group>

          {/* Follow-up Priority (conditional) */}
          {requiresFollowup && (
            <Form.Group className="mb-3">
              <Form.Label>Follow-up Priority</Form.Label>
              <Form.Select
                value={followupPriority}
                onChange={(e) => setFollowupPriority(e.target.value)}
                disabled={loading}
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
              </Form.Select>
              <Form.Text className="text-muted">
                This helps management prioritize their follow-up actions.
              </Form.Text>
            </Form.Group>
          )}

          {/* Response Message */}
          <Form.Group className="mb-3">
            <Form.Label>
              Additional Comments 
              {requiresFollowup && <span className="text-danger">*</span>}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder={
                requiresFollowup 
                  ? "Please provide details about your situation or what assistance you need..."
                  : "Add any additional comments or feedback (optional)..."
              }
              maxLength={1000}
              disabled={loading}
              required={requiresFollowup}
            />
            <Form.Text className="text-muted">
              {responseMessage.length}/1000 characters
              {requiresFollowup && " (Required for follow-up responses)"}
            </Form.Text>
          </Form.Group>

          {/* Anonymous Option */}
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="isAnonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              disabled={loading}
              label="Submit this response anonymously"
            />
            <Form.Text className="text-muted">
              Your name will not be visible to the notice issuer, but management can still identify you for follow-up if needed.
            </Form.Text>
          </Form.Group>

          {/* Follow-up Explanation */}
          {requiresFollowup && (
            <Alert variant="info">
              <AlertTriangle size={16} className="me-2" />
              <strong>This response requires follow-up.</strong> Management will be notified and may contact you for additional assistance or clarification.
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              {existingResponse && (
                <Button 
                  variant="outline-danger" 
                  onClick={handleWithdrawResponse}
                  disabled={loading}
                  className="d-flex align-items-center"
                >
                  <X size={14} className="me-1" />
                  Withdraw Response
                </Button>
              )}
            </div>
            
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={onHide} disabled={loading}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={loading || (requiresFollowup && !responseMessage.trim())}
                className="d-flex align-items-center"
              >
                {loading ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                    {existingResponse ? 'Updating...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Check size={14} className="me-1" />
                    {existingResponse ? 'Update Response' : 'Submit Response'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default NoticeResponseModal;