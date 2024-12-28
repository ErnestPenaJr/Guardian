
namespace Models {

public record EmailData {
    public required string From {get;init;}

    public required List<string> To {get;init;}

    public List<string>? Cc {get;init;}

    public required string Subject {get;init;}

    public required string Body {get;init;}

    public List<DocumentData>? Attachments {get;init;} 

}

}