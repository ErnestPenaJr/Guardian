export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Totals {
    critical: number;
    high: number;
    medium: number;
    tentative: number;
}

export interface Trend {
    prior_report_date: string | null;
    resolved: number;
    persistent: number;
    new: number;
    direction: 'first_run' | 'improving' | 'degrading' | 'flat';
}

export interface SecurityFinding {
    id: number;
    severity: Severity;
    confidence: number;
    status: string;
    phase: number;
    phase_name: string;
    category: string;
    fingerprint: string;
    title: string;
    file: string;
    line: number;
    commit?: string;
    description: string;
    exploit_scenario: string;
    impact: string;
    recommendation: string;
    playbook: string;
    verification: string;
}

export interface AttackSurfaceCode {
    total_routes: number;
    authed_via_middleware: number;
    unauth_mutating_routes: number;
    requirePermission_uses: number;
    requireJafar_uses: number;
    file_upload_points: number;
    admin_routes: number;
}

export interface AttackSurfaceInfra {
    ci_workflows: number;
    duplicate_pipelines_deploying_to_same_app: boolean;
    container_configs: number;
    iac_configs: number;
    deploy_targets: string[];
    secret_management: string;
}

export interface SupplyChainSummary {
    direct_deps: number;
    dev_deps: number;
    transitive_deps_total: number;
    critical_cves: number;
    high_cves: number;
    moderate_cves: number;
    low_cves: number;
    install_scripts_in_prod_deps: string;
    lockfile_present: boolean;
    lockfile_tracked: boolean;
    tools_skipped: string[];
}

export interface SecurityReport {
    version: string;
    date: string;
    mode: string;
    scope: string;
    diff_mode: boolean;
    phases_run: number[];
    attack_surface: {
        code: AttackSurfaceCode;
        infrastructure: AttackSurfaceInfra;
    };
    findings: SecurityFinding[];
    supply_chain_summary: SupplyChainSummary;
    filter_stats: Record<string, number>;
    totals: Totals;
    trend: Trend;
}

export interface SecurityReportSummary {
    filename: string;
    date: string;
    mode: string;
    scope: string;
    totals: Totals;
    trend: Trend;
}

export interface SecurityReportListResponse {
    reports: SecurityReportSummary[];
}
