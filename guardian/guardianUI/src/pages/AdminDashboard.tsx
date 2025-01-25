import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Box, Link, Stack, Typography } from '@mui/material';
import { AccountTreeOutlined, PeopleOutlined, SettingsOutlined } from '@mui/icons-material';

export default function AdminDashboard() {
    return (
        <Box sx={{ mt: 10, display: 'flex', justifyContent: 'center', minWidth: '100%' }}>
            <Stack mt={3} direction={'row'} spacing={2} display={'flex'} justifyContent={'center'}>
                <Card sx={{ minWidth: 250 }}>
                    <CardContent>
                        <Stack alignItems="center">
                            <AccountTreeOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                            <Typography sx={{ mt: 2, color: '#05445E', fontWeight: 'bold' }}>Workflows</Typography>
                            <Link href="/admin/formbuilder" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                                Create A Workflow
                            </Link>
                            <Link href="/admin/workflows" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                                View Workflows
                            </Link>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ minWidth: 250 }}>
                    <CardContent>
                        <Stack alignItems="center">
                            <PeopleOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                            <Typography sx={{ mt: 2, color: '#05445E', fontWeight: 'bold' }}>Users</Typography>
                            <Link href="/admin/manageusers" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                                Manage Users
                            </Link>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ minWidth: 250 }}>
                    <CardContent>
                        <Stack alignItems="center">
                            <SettingsOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                            <Typography sx={{ mt: 2, color: '#05445E', fontWeight: 'bold' }}>Settings</Typography>
                            <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                                Change Password
                            </Link>
                            {/* <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none' }}>
                                    Update Preferences
                                </Link> */}
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
}

