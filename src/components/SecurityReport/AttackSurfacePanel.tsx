import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AttackSurfaceCode, AttackSurfaceInfra } from './types';

interface AttackSurfacePanelProps {
    code: AttackSurfaceCode;
    infrastructure: AttackSurfaceInfra;
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono">{value}</span>
    </div>
);

const AttackSurfacePanel: React.FC<AttackSurfacePanelProps> = ({ code, infrastructure }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 p-3 text-left font-semibold hover:bg-gray-50"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Attack Surface
            </button>
            {open && (
                <div className="grid md:grid-cols-2 gap-6 p-4 border-t border-gray-200">
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Code</h4>
                        <Row label="Total routes" value={code.total_routes} />
                        <Row label="Authed via middleware" value={code.authed_via_middleware} />
                        <Row label="Unauth mutating routes" value={code.unauth_mutating_routes} />
                        <Row label="requirePermission uses" value={code.requirePermission_uses} />
                        <Row label="requireJafar uses" value={code.requireJafar_uses} />
                        <Row label="File upload points" value={code.file_upload_points} />
                        <Row label="Admin routes" value={code.admin_routes} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Infrastructure</h4>
                        <Row label="CI workflows" value={infrastructure.ci_workflows} />
                        <Row label="Duplicate pipelines → same app" value={String(infrastructure.duplicate_pipelines_deploying_to_same_app)} />
                        <Row label="Container configs" value={infrastructure.container_configs} />
                        <Row label="IaC configs" value={infrastructure.iac_configs} />
                        <Row label="Deploy targets" value={(infrastructure.deploy_targets || []).join(', ') || '—'} />
                        <Row label="Secret management" value={infrastructure.secret_management} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttackSurfacePanel;
