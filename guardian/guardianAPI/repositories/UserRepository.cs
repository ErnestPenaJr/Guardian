//User Status: Invited, Pending, Denied, Active, Inactive


using Models;

namespace Repositories
{
    public class UserRepository
    {
        public List<UserStatus> GetStatusTypes()
        {
            return
            [
                new () { StatusId = 1, StatusName = "Invited" },
                new () { StatusId = 2, StatusName = "Pending" },
                new () { StatusId = 3, StatusName = "Denied" },
                new () { StatusId = 4, StatusName = "Active" },
                new () { StatusId = 5, StatusName = "Inactive" }
            ];
        }

        public List<UserGridData> GetUsers()
        {
            return
            [
                new UserGridData { Id = 1, LastName = "Boy", FirstName = "Jon", Email = "jon@fbi.com", Role = "External User", UserStatus = "Active" },
                new UserGridData { Id = 2, LastName = "Investigator", FirstName = "Bob", Email = "bob@fbi.com", Role = "Processor", UserStatus = "Active" },
                new UserGridData { Id = 3, LastName = "Geller", FirstName = "Ross", Email = "ross@fbi.com", Role = "General User", UserStatus = "Pending" },
                new UserGridData { Id = 4, LastName = "Bing", FirstName = "Monica", Email = "monica@fbi.com", Role = "General User", UserStatus = "Invited" },
                new UserGridData { Id = 5, LastName = "Loser", FirstName = "Big", Email = "loser@fbi.com", Role = "External User", UserStatus = "Denied" },
                new UserGridData { Id = 6, LastName = "Buffay", FirstName = "Phoebe", Email = "phoebe@fbi.com", Role = "Administrator", UserStatus = "Active" },
                new UserGridData { Id = 7, LastName = "Bong", FirstName = "Ms Chanandler", Email = "chananadler@fbi.com", Role = "External User", UserStatus = "Invited" },
                new UserGridData { Id = 8, LastName = "Coffee", FirstName = "Gunther", Email = "gunther@fbi.com", Role = "Manager", UserStatus = "Active" },
                new UserGridData { Id = 9, LastName = "Tribbianni", FirstName = "Joey", Email = "joey@fbi.com", Role = "External User", UserStatus = "Pending" }
            ];
        }
    }
}