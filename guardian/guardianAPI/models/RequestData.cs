

namespace Models {

    public record RequestData {
        public required int RequestId {get;init;}
    }

    public record RequestFormData {
        public required string RequestType {get;init;}


    }

    public record TaskData {
        public required int TaskId {get;init;}
        public required int RequestId {get;init;}
        public required string Assigned {get;init;}
        public required string Description {get;init;}
    }



}