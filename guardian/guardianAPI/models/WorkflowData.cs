

namespace Models {


    public record WorkflowData {
        public required string Name {get;init;}

        public required string Description {get;init;}

        public required bool Active {get;init;}

        public required bool External {get;init;}

        public required string WorkflowType {get;init;}

        public required string CustomWorkflow {get;init;} //represent the json
    }

}