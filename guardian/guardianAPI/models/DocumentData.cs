
namespace Models {


    public record DocumentData {
        public required string FileName {get;init;}

        public required string FileType {get;init;}
        public required byte[] FileData {get;init;}

    }
}