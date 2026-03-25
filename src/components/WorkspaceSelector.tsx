import { useState, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

interface Workspace {
  WORKSPACE_ID: number;
  WORKSPACE_NAME: string;
  DESCRIPTION?: string;
  IS_DEFAULT: boolean;
  IS_USER_DEFAULT: boolean;
  IS_ASSIGNED: boolean;
  IS_CURRENT_ACTIVE: boolean;
}

export default function WorkspaceSelector() {
  const { user, switchWorkspace } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Fetch user's available workspaces
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/users/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces);
        
        // Find current active workspace
        const activeWorkspace = data.workspaces.find((w: Workspace) => w.IS_CURRENT_ACTIVE);
        if (activeWorkspace) {
          setCurrentWorkspace(activeWorkspace);
        } else if (data.workspaces.length > 0) {
          // Default to first workspace if no active one found
          setCurrentWorkspace(data.workspaces[0]);
        }
      } else {
        console.warn('Workspace fetch returned non-OK — workspace selector hidden');
      }
    } catch (error) {
      console.warn('Error fetching workspaces (non-critical):', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    if (workspace.WORKSPACE_ID === currentWorkspace?.WORKSPACE_ID) {
      setIsOpen(false);
      return;
    }

    try {
      setLoading(true);
      await switchWorkspace(workspace.WORKSPACE_ID, workspace.WORKSPACE_NAME);
      setCurrentWorkspace(workspace);
      setIsOpen(false);
      
      toast.success(`Switched to ${workspace.WORKSPACE_NAME}`, {
        position: "top-right",
        autoClose: 2000,
      });

      // Refresh the page to update all data with new workspace context
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error('Error switching workspace:', error);
      toast.error('Failed to switch workspace', {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show selector if user only has one workspace or no workspaces
  if (!user || workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current workspace button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`
          flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 
          bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Building2 size={16} />
        <span className="max-w-32 truncate">
          {currentWorkspace?.WORKSPACE_NAME || 'Select Workspace'}
        </span>
        <ChevronDown 
          size={16} 
          className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Switch Workspace
            </p>
          </div>
          
          <div className="py-1 max-h-60 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.WORKSPACE_ID}
                onClick={() => handleWorkspaceSwitch(workspace)}
                disabled={loading}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-left 
                  hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                  ${workspace.WORKSPACE_ID === currentWorkspace?.WORKSPACE_ID ? 'bg-teal-50' : ''}
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Building2 size={14} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {workspace.WORKSPACE_NAME}
                    </span>
                    {workspace.IS_DEFAULT && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                  </div>
                  {workspace.DESCRIPTION && (
                    <p className="text-xs text-gray-500 mt-0.5 pl-5">
                      {workspace.DESCRIPTION}
                    </p>
                  )}
                </div>
                
                {workspace.WORKSPACE_ID === currentWorkspace?.WORKSPACE_ID && (
                  <Check size={16} className="text-teal-600" />
                )}
              </button>
            ))}
          </div>

          {/* Footer with workspace count */}
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}