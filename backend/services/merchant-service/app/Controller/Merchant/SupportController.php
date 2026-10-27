<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

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
    protected \App\Service\GuideHubService $guides;
    #[Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    public function options(): array { return Result::success($this->tickets->options('merchant')); }
    public function index(): array { return Result::success($this->tickets->listing('merchant', $this->request->all())); }
    public function summary(): array { return Result::success($this->tickets->listing('merchant', $this->request->all(), true)); }
    public function detail(): array { return Result::success($this->tickets->detail('merchant', $this->requireId('ticketId'))); }
    public function replies(): array { return Result::success($this->tickets->history('merchant', $this->request->all(), false)); }
    public function events(): array { return Result::success($this->tickets->history('merchant', $this->request->all(), true)); }
    public function faqCategories(): array { return Result::success((new \App\Service\SupportContentService())->faq('categories', $this->request->all())); }
    public function faqList(): array { return Result::success((new \App\Service\SupportContentService())->faq('list', $this->request->all())); }
    public function faqDetail(): array { return Result::success((new \App\Service\SupportContentService())->faq('detail', $this->request->all())); }
    public function compliance(): array
    {
        $kind = basename($this->request->getUri()->getPath());
        return Result::success((new \App\Service\SupportContentService())->compliance($kind, $this->request->all()));
    }
    public function guideCategories(): array { return Result::success($this->guides->read('categories', $this->request->all())); }
    public function guideList(): array { return Result::success($this->guides->read('list', $this->request->all())); }
    public function guideDetail(): array { return Result::success($this->guides->read('detail', $this->request->all())); }

    #[Permission('mch:support:create')]
    public function create(): array { return Result::success($this->tickets->mutate('merchant', 'create', $this->request->all())); }
    #[Permission('mch:support:reply')]
    public function reply(): array { return Result::success($this->tickets->mutate('merchant', 'reply', $this->request->all())); }
    #[Permission('mch:support:close')]
    public function close(): array { return Result::success($this->tickets->mutate('merchant', 'close', $this->request->all())); }
    #[Permission('mch:support:reopen')]
    public function reopen(): array { return Result::success($this->tickets->mutate('merchant', 'reopen', $this->request->all())); }
    #[Permission(['mch:support:create', 'mch:support:reply'])]
    public function upload(): array { return Result::success($this->files->upload('merchant', $this->request->all(), $this->request->file('file'))); }
    public function download(): \Psr\Http\Message\ResponseInterface
    {
        $file = $this->files->download('merchant', $this->requireId('attachmentId'));
        return $this->response->download($file['path'], $file['filename'])->withHeader('Content-Type', $file['mime'])
            ->withHeader('Cache-Control', 'no-store, private')->withHeader('X-Content-Type-Options', 'nosniff');
    }
}
