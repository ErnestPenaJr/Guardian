

namespace Models {


    public record WorkflowData {

        public required int WorkflowId {get;init;}

        public required string Name {get;init;}

        public required string Description {get;init;}

        public required bool Active {get;init;}

        public required bool External {get;init;}

        public required bool SelfService {get;init;} = false;

        public required string WorkflowType {get;init;}

        public required string CustomWorkflow {get;init;} //represent the json
    }

    public record WorkflowGridData {

        public required int WorkflowId {get;init;}
        public required string Name {get;init;}

        public required string WorkflowType {get;init;}

        public required bool External {get;init;}

        public required bool Active {get;init;}

    }

    //TODO: just doc purposes right this moment
    enum WorkflowType {
        Request,
        SelfService,
        Notice,
    }

}

