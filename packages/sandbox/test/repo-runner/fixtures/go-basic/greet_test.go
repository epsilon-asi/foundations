package greet

import "testing"

func TestGreet(t *testing.T) {
	if got := Greet("go"); got != "hello go" {
		t.Fatalf("Greet() = %q", got)
	}
}
