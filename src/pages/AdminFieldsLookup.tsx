import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';

interface LookupValue {
  LOOKUP_ID: number;
  FIELD_ID: number;
  LOOKUP_VALUE: string;
  DISPLAY_ORDER: number;
}

interface AdminFieldsLookupProps {
  fieldId: number;
}

const AdminFieldsLookup: React.FC<AdminFieldsLookupProps> = ({ fieldId }) => {
  const [lookupValues, setLookupValues] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fetch lookup values for the field
  useEffect(() => {
    const fetchLookupValues = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/fields/${fieldId}/lookups`);
        setLookupValues(response.data);
      } catch (error) {
        console.error('Error fetching lookup values:', error);
        toast.error('Failed to load lookup values');
      } finally {
        setLoading(false);
      }
    };

    if (fieldId) {
      fetchLookupValues();
    }
  }, [fieldId]);

  // Add new lookup value
  const handleAddValue = async () => {
    if (!newValue.trim()) return;

    try {
      const response = await axios.post(`/api/fields/${fieldId}/lookups`, {
        LOOKUP_VALUE: newValue,
        DISPLAY_ORDER: lookupValues.length + 1
      });
      
      setLookupValues([...lookupValues, response.data]);
      setNewValue('');
      toast.success('Lookup value added successfully');
    } catch (error) {
      console.error('Error adding lookup value:', error);
      toast.error('Failed to add lookup value');
    }
  };

  // Update lookup value
  const handleUpdateValue = async (lookupId: number) => {
    if (!editValue.trim()) return;

    try {
      await axios.put(`/api/fields/${fieldId}/lookups/${lookupId}`, {
        LOOKUP_VALUE: editValue
      });
      
      setLookupValues(lookupValues.map(item => 
        item.LOOKUP_ID === lookupId ? { ...item, LOOKUP_VALUE: editValue } : item
      ));
      
      setEditingId(null);
      setEditValue('');
      toast.success('Lookup value updated successfully');
    } catch (error) {
      console.error('Error updating lookup value:', error);
      toast.error('Failed to update lookup value');
    }
  };

  // Delete lookup value
  const handleDeleteValue = async (lookupId: number) => {
    if (!window.confirm('Are you sure you want to delete this lookup value?')) return;

    try {
      await axios.delete(`/api/fields/${fieldId}/lookups/${lookupId}`);
      setLookupValues(lookupValues.filter(item => item.LOOKUP_ID !== lookupId));
      toast.success('Lookup value deleted successfully');
    } catch (error) {
      console.error('Error deleting lookup value:', error);
      toast.error('Failed to delete lookup value');
    }
  };

  // Start editing a value
  const startEditing = (lookup: LookupValue) => {
    setEditingId(lookup.LOOKUP_ID);
    setEditValue(lookup.LOOKUP_VALUE);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  if (loading) {
    return <div className="py-4">Loading lookup values...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Lookup Values</h3>
      
      {/* Add new value form */}
      <div className="flex space-x-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Add new lookup value"
          className="flex-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
        />
        <button
          onClick={handleAddValue}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FaPlus className="mr-1" /> Add
        </button>
      </div>
      
      {/* List of lookup values */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {lookupValues.length === 0 ? (
            <li className="px-4 py-4 text-sm text-gray-500">
              No lookup values defined yet. Add some using the form above.
            </li>
          ) : (
            lookupValues.map((lookup) => (
              <li key={lookup.LOOKUP_ID} className="px-4 py-3">
                {editingId === lookup.LOOKUP_ID ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateValue(lookup.LOOKUP_ID)}
                      className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <FaCheck className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {lookup.LOOKUP_VALUE}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditing(lookup)}
                        className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <FaEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteValue(lookup.LOOKUP_ID)}
                        className="inline-flex items-center p-1.5 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default AdminFieldsLookup;
