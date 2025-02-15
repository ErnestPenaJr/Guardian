

namespace Models {


    public record WorkflowData {

        public required Guid Id {get;init;}

        public required string Name {get;init;}

        public required string Description {get;init;}

        public required bool IsActive {get;init;}

        public required bool IsExternal {get;init;}

        // public required bool SelfService {get;init;} = false;

        public required string WorkflowType {get;init;}

        public required string WorkflowDefinition {get;init;} //represent the json
    }

    public record WorkflowGridData {

        public required Guid Id {get;init;}
        public required string Name {get;init;}

        public required string WorkflowType {get;init;}

        public required bool IsExternal {get;init;}

        public required bool IsActive {get;init;}

    }

    //TODO: just doc purposes right this moment
    enum WorkflowType {
        Request,
        SelfService,
        Notice,
    }

}

