namespace AppSettings 
{
    public class EnvironmentSettings {
        public const string SectionName = "EnvironmentSettings";

        public string EmailHost {get;set;} = string.Empty;
    }

    public class SmtpSettings {
        public const string SectionName = "SmtpSettings";

        public string Host {get;set;} = string.Empty;

        public int Port {get;set;} = 25;

        public bool Bypass {get;set;} = false;

        public bool UseSsl {get;set;} = false;

        public bool UseCredentials {get;set;} = false;

        public string User {get;set;} = string.Empty;

        public string Password {get;set;} = string.Empty;
    }

}