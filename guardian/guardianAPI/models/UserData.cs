
namespace Models {

    public record UserData {

        public required string FirstName {get; init;}
        public required string LastName {get; init;}
        public required string Organization {get; init;}
        public required string Email {get; init;}
        public required int RoleId {get; init;}
        public required string RoleName {get;init;}
        public required int StatusId {get; init;}
        public required string StatusName {get; init;}

        //last login / last active?
        
    }

    public record UserGridData {

        public required int Id {get; init;}
        public required string FirstName {get; init;}
        public required string LastName {get; init;}
        // public required string Organization {get; init;}
        public required string Email {get; init;}
        public required string Role {get;init;}
        public required string UserStatus {get; init;}
    }

    public record UserStatus {
        public required int StatusId {get; init;}
        public required string StatusName {get; init;}
    }
    


}