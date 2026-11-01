run "greets_by_name" {
  command = plan

  variables {
    name = "terraform"
  }

  assert {
    condition     = output.greeting == "hello terraform"
    error_message = "unexpected greeting"
  }
}
