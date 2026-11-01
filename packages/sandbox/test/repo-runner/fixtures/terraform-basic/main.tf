terraform {
  required_version = ">= 1.6.0"
}

variable "name" {
  type    = string
  default = "sandbox"
}

locals {
  greeting = "hello ${var.name}"
}

output "greeting" {
  value = local.greeting
}
