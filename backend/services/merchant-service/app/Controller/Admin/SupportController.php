<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\SupportAttachmentService;
use App\Service\SupportTicketService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

class SupportController extends AbstractController
{
    #[Inject]
    protected SupportTicketService $tickets;
    #[Inject]
    protected SupportAttachmentService $files;
    #[Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    #[Permission('help:ticket:list')]
    public function options(): array { return Result::success($this->tickets->options('admin')); }
    #[Permission('help:ticket:list')]
    public function index(): array { return Result::success($this->tickets->listing('admin', $this->request->all())); }
    #[Permission('help:ticket:list')]
    public function summary(): array { return Result::success($this->tickets->listing('admin', $this->request->all(), true)); }
    #[Permission('help:ticket:list')]
    public function detail(): array { return Result::success($this->tickets->detail('admin', $this->requireId('ticketId'))); }
    #[Permission('help:ticket:list')]
    public function replies(): array { return Result::success($this->tickets->history('admin', $this->request->all(), false)); }
    #[Permission('help:ticket:list')]
    public function events(): array { return Result::success($this->tickets->history('admin', $this->request->all(), true)); }
    #[Permission('help:ticket:list')]
    public function assignees(): array { return Result::success($this->tickets->assignees('admin', $this->requireId('ticketId'))); }
    #[Permission('help:ticket:reply')]
    public function reply(): array { return Result::success($this->tickets->mutate('admin', 'reply', $this->request->all())); }
    #[Permission('help:ticket:assign')]
    public function assign(): array { return Result::success($this->tickets->mutate('admin', 'assign', $this->request->all())); }
    #[Permission('help:ticket:priority')]
    public function priority(): array { return Result::success($this->tickets->mutate('admin', 'priority', $this->request->all())); }
    #[Permission('help:ticket:status')]
    public function status(): array { return Result::success($this->tickets->mutate('admin', 'status', $this->request->all())); }
    #[Permission('help:ticket:reopen')]
    public function reopen(): array { return Result::success($this->tickets->mutate('admin', 'reopen', $this->request->all())); }
    #[Permission('help:ticket:reply')]
    public function upload(): array { return Result::success($this->files->upload('admin', $this->request->all(), $this->request->file('file'))); }
    #[Permission('help:ticket:list')]
    public function download(): \Psr\Http\Message\ResponseInterface
    {
        $file = $this->files->download('admin', $this->requireId('attachmentId'));
        return $this->response->download($file['path'], $file['filename'])->withHeader('Content-Type', $file['mime'])
            ->withHeader('Cache-Control', 'no-store, private')->withHeader('X-Content-Type-Options', 'nosniff');
    }
}
