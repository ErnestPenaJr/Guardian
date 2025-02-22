import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';

export const userAccountSchema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(1, { message: 'Password is Required' }),
    passwordConfirm: z.string().min(1, { message: 'Confirm your password' }),
})

type UserAccountSchema = z.infer<typeof userAccountSchema>;

export const RegistrationInfo = () => {

    const { register, handleSubmit, formState: { errors } } = useForm<UserAccountSchema>({
        resolver: zodResolver(userAccountSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            passwordConfirm: "",
        }
    })

    const onSubmit: SubmitHandler<UserAccountSchema> = async (data) => {
        console.log("save the user shiz?", data);
    }

    return (   
        <form onSubmit={handleSubmit(onSubmit)}> 
        <Stack direction='row' spacing={2} sx={{ mt: 4 }}>
            <TextField
                required
                label="First Name"
                size="small"
                fullWidth
                variant="outlined"                
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                {...register("firstName")}
            />
            <TextField
                required
                label="Last Name"
                size="small"
                fullWidth
                variant="outlined"
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                {...register("lastName")}
            />               
        </Stack>
        <Stack sx={{ mt: 2 }}>
            <TextField
                required
                label="Email Address"
                size="small"
                fullWidth
                variant="outlined"
                error={!!errors.email}
                helperText={errors.email?.message}
                {...register("email")}
            />
        </Stack>
        <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
            <TextField
                required
                label="Password"
                size="small"
                fullWidth
                variant="outlined"
                error={!!errors.password}
                helperText={errors.password?.message}
                {...register("password")}
            />
            <TextField
                required
                label="Confirm Password"
                size="small"
                fullWidth
                variant="outlined"
                error={!!errors.passwordConfirm}
                helperText={errors.passwordConfirm?.message}
                {...register("passwordConfirm")}
            />
        </Stack>
        </form>
    )
}

export const JoinOrCreate = () => { 

    return (
        <><Stack sx={{ mt: 4 }}>
            <Typography component={'span'}><span style={{color: 'red'}}>*</span> Are you creating a new organization or joining an existing one within Guardian?</Typography>
        </Stack>
        <Stack sx={{ mt: 2 }} justifyContent="center" alignItems="center">
            <RadioGroup
                row
                // onChange={(evt, value) => {
                //     setStepPath(value)
                //     setValue("path", value)
                // }}
            >
                <FormControlLabel value="neworg" control={<Radio size="small" />} label="Create New Organization" />
                <FormControlLabel value="joinorg" control={<Radio size="small" />} label="Join Existing Organization" />
            </RadioGroup>
        </Stack>
        </>
    )
}

export type RoleTypeData = { name: string, value: string}

//Executive, Supervisor, Investigator, Officer, Analyst, Support, Other
export const userroles: RoleTypeData[] = [
    { name: "Analyst", value: "analyst"},
    { name: "Executive", value: "executive"},
    { name: "Investigator", value: "investigator"},
    { name: "Supervisor", value: "supervisor"},
    { name: "Support", value: "support"},
    { name: "Officer", value: "officer"},
    { name: "Other", value: "other"},
];

export const NewOrganization = () => { 

    return (
        <><Stack sx={{ mt: 4 }}>
            <TextField
                required
                label="Organization Name"
                size="small"
                fullWidth
                variant="outlined"
            />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Typography component={'span'}><span style={{color: 'red'}}>*</span> What best describes your current role?</Typography>
            <TextField
                required
                select
                size="small"
                sx={{ minWidth: '150px;'}}
            >
                {userroles.map(({ value, name }, index) => (
                    <MenuItem key={index} value={value}>
                        {name}
                    </MenuItem>
                ))}
            </TextField>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Typography component={'span'}><span style={{color: 'red'}}>*</span> How many people are on your team?</Typography>
            <TextField
                required
                select
                size="small"
                sx={{ minWidth: '100px;'}}
            >
                <MenuItem value={"1"}>1-5</MenuItem>
                <MenuItem value={"2"}>6-10</MenuItem>
                <MenuItem value={"3"}>11-15</MenuItem>
                <MenuItem value={"4"}>16-25</MenuItem>
                <MenuItem value={"5"}>25+</MenuItem>
            </TextField>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Typography component={'span'}><span style={{color: 'red'}}>*</span> How many people are in your organization?</Typography>
            <TextField
                required
                select
                size="small"
                sx={{ minWidth: '110px;'}}
            >
                <MenuItem value={"1"}>1-19</MenuItem>
                <MenuItem value={"2"}>20-49</MenuItem>
                <MenuItem value={"3"}>50-99</MenuItem>
                <MenuItem value={"4"}>100-250</MenuItem>
                <MenuItem value={"5"}>251-500</MenuItem>
                <MenuItem value={"6"}>500-1500</MenuItem>
                <MenuItem value={"7"}>1500+</MenuItem>
            </TextField>
        </Stack>
        </>
    )
}
