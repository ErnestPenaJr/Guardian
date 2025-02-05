


//name, organization, email, active, roleId, 

using Repositories;

namespace Handlers
{
    public static class UsersHandler
    {
        public static RouteGroupBuilder MapUsersApi(this RouteGroupBuilder group)
        {
            group.MapGet("/users", (UserRepository userRepo) => userRepo.GetUsers());


            group.MapGet("/users/statuses", (UserRepository userRepo) => userRepo.GetStatusTypes());
            
            return group;
        }
    }
}