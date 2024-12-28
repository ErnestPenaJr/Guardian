import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Link, Stack, Typography } from '@mui/material';
import { PeopleOutlined, SettingsOutlined, WorkOutlineOutlined } from '@mui/icons-material';

export default function AdminDashboard() {
    return (
        <><Stack direction={'row'} spacing={2}>
            <Card sx={{ minWidth: 250 }}>
                <CardContent>
                    <Stack alignItems="center">
                        <PeopleOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                        <Typography sx={{ color: '#05445E', fontWeight: 'bold' }}>Requests</Typography>
                        <Link href="/admin/newrequest" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                            Create Request Form
                        </Link>
                    </Stack>
                </CardContent>
            </Card>
            <Card sx={{ minWidth: 250 }}>
                <CardContent>
                    <Stack alignItems="center">
                        <PeopleOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                        <Typography sx={{ color: '#05445E', fontWeight: 'bold' }}>Users</Typography>
                        <Link href="/admin/manageusers" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                            Manage Users
                        </Link>
                    </Stack>
                </CardContent>
            </Card>
            <Card sx={{ minWidth: 250 }}>
                <CardContent>
                    <Stack alignItems="center">
                        <WorkOutlineOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                        <Typography sx={{ color: '#05445E', fontWeight: 'bold' }}>Account</Typography>
                        <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                            Licenses
                        </Link>
                        <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none' }}>
                            Setup
                        </Link>
                    </Stack>
                </CardContent>
            </Card>
            <Card sx={{ minWidth: 250 }}>
                <CardContent>
                    <Stack alignItems="center">
                        <SettingsOutlined sx={{ color: '#05445E', fontSize: '80px', justifyContent: 'center' }} />
                        <Typography sx={{ color: '#05445E', fontWeight: 'bold' }}>Settings</Typography>
                        <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none', mt: 2 }}>
                            Change Password
                        </Link>
                        <Link href="/" variant="body2" sx={{ color: '#05445E', textAlign: 'center', textDecoration: 'none' }}>
                            Update Preferences
                        </Link>
                    </Stack>
                </CardContent>
            </Card>
        </Stack></>
    );
}

