// Package greet is a dependency-free library used by the repo-runner Go fixture.
package greet

// Greet returns a greeting for name.
func Greet(name string) string {
	return "hello " + name
}
