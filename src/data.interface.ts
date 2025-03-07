export interface Data{
    turnout: any;
    results?: {
        candidate: string,
        votes: number,
        percentage: string,
    }[],
    partylist_valid_vote?: number,
    senate_valid_vote?: number,
    voters_voted?: number,
    LDL: number,
    CTB: number
    location: string;
}