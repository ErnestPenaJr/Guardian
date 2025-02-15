


using Models;


namespace Services
{

    public class TempUserService {

        public UserData GetUserInfo() {
            return new UserData {
                FirstName = "John",
                LastName = "Doe",
                Organization = "D6FE7580-A3D7-47CF-8457-EBB241E9B3A8",
                Email = "johndoe@johndoe.com",
                RoleId = 1,
                RoleName = "Administrator",
                StatusId = 1,
                StatusName = "Active"
            };
        }
    }

}