export interface Movie {
  id: number;
  title: string;
  year: number;
  rating: number;
}

export const movies: Movie[] = [
  { id: 1, title: 'The Shawshank Redemption', year: 1994, rating: 4.9 },
  { id: 2, title: 'The Godfather', year: 1972, rating: 4.8 },
  { id: 3, title: 'The Dark Knight', year: 2008, rating: 4.7 },
  { id: 4, title: 'Pulp Fiction', year: 1994, rating: 4.6 },
  { id: 5, title: 'Fight Club', year: 1999, rating: 4.5 },
  { id: 6, title: 'Inception', year: 2010, rating: 4.4 },
  { id: 7, title: 'The Matrix', year: 1999, rating: 4.3 },
  { id: 8, title: 'Goodfellas', year: 1990, rating: 4.2 },
  { id: 9, title: 'The Silence of the Lambs', year: 1991, rating: 4.1 },
  { id: 10, title: 'Schindler\'s List', year: 1993, rating: 4.0 },
  { id: 11, title: 'Forrest Gump', year: 1994, rating: 4.8 },
  { id: 12, title: 'The Green Mile', year: 1999, rating: 4.7 }
];